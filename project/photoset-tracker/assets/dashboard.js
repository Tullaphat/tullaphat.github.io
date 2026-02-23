const { createApp } = Vue;

createApp({
  data() {
    return {
      session: null,
      collections: [],
      expandedCollections: {},
      showModal: false,
      editingCollectionId: null,
      showPhotoModal: false,
      photoModalMode: 'new',
      activePhotoTarget: null,
      existingPhotoData: null,
      photoSaving: false,
      saving: false,
      message: '',
      messageType: '',
      showSettings: false,
      displayNameForm: '',
      oldPin: '',
      newPin: '',
      confirmPin: '',
      activePinField: null,
      pinInput: '',
      dragOverTarget: null,
      form: {
        name: '',
        year: '',
        description: '',
        type: 'single',
        single: {
          rVariety: 0,
          ssrVariety: 0,
        },
        group: [
          { name: 'A', rVariety: 0, ssrVariety: 0 },
          { name: 'B', rVariety: 0, ssrVariety: 0 },
          { name: 'C', rVariety: 0, ssrVariety: 0 },
        ],
        groupTemplate: {
          rVariety: 0,
          ssrVariety: 0,
        },
      },
    };
  },
  async mounted() {
    const session = window.AuthApi.getSession();

    if (!session || !session.email) {
      window.location.href = './index.html';
      return;
    }

    this.session = session;
    await this.loadCollections();
  },
  methods: {
    setMessage(text, type = 'error') {
      this.message = text;
      this.messageType = type;
    },
    clearMessage() {
      this.message = '';
      this.messageType = '';
    },
    async loadCollections() {
      try {
        const result = await window.AuthApi.getCollections(this.session.email);
        this.collections = result.collections || [];
      } catch (_) {
        this.setMessage('Unable to load collections.');
      }
    },
    toggleCollection(collectionId) {
      this.expandedCollections = {
        ...this.expandedCollections,
        [collectionId]: !this.expandedCollections[collectionId],
      };
    },
    openModal() {
      this.resetForm();
      this.editingCollectionId = null;
      this.showModal = true;
      this.clearMessage();
    },
    startEdit(collection) {
      this.clearMessage();
      this.editingCollectionId = collection.id;
      this.form = {
        name: collection.name || '',
        year: collection.year || '',
        description: collection.description || '',
        type: collection.type || 'single',
        single: collection.type === 'single'
          ? {
              rVariety: this.normalizeNumber(collection.single?.rVariety),
              ssrVariety: this.normalizeNumber(collection.single?.ssrVariety),
            }
          : {
              rVariety: 0,
              ssrVariety: 0,
            },
        group: collection.type === 'group'
          ? (collection.group || []).map((person, index) => ({
              name: person.name || String.fromCharCode(65 + index),
              rVariety: this.normalizeNumber(person.rVariety),
              ssrVariety: this.normalizeNumber(person.ssrVariety),
            }))
          : [{ name: 'A', rVariety: 0, ssrVariety: 0 }],
      };

      if (this.form.type === 'group' && this.form.group.length === 0) {
        this.form.group = [{ name: 'A', rVariety: 0, ssrVariety: 0 }];
      }

      this.showModal = true;
    },
    closeModal() {
      if (!this.saving) {
        this.showModal = false;
      }
    },
    getFullPhotoData(collection, rarity, slotIndex, personIndex = null) {
      if (collection.type === 'single') {
        const singlePhotos = collection.photos && !Array.isArray(collection.photos) ? collection.photos : {};
        const bucket = rarity === 'r' ? singlePhotos.r : singlePhotos.ssr;
        const item = Array.isArray(bucket) ? bucket[slotIndex] : null;
        return item || null;
      }

      const groupPhotos = Array.isArray(collection.photos) ? collection.photos : [];
      const personPhotos = groupPhotos[personIndex] || {};
      const bucket = rarity === 'r' ? personPhotos.r : personPhotos.ssr;
      const item = Array.isArray(bucket) ? bucket[slotIndex] : null;
      return item || null;
    },
    openPhotoOptions(collection, rarity, slotIndex, personIndex = null) {
      const existingData = this.getFullPhotoData(collection, rarity, slotIndex, personIndex);
      const photoExists = existingData && (typeof existingData === 'string' || (typeof existingData === 'object' && existingData.src));

      this.activePhotoTarget = {
        collectionId: collection.id,
        rarity,
        slotIndex,
        personIndex,
      };

      if (photoExists) {
        this.photoModalMode = 'edit';
        this.existingPhotoData = typeof existingData === 'string' ? { src: existingData, count: 1 } : { ...existingData };
      } else {
        this.photoModalMode = 'new';
        this.existingPhotoData = null;
      }

      this.showPhotoModal = true;
      this.clearMessage();
    },
    closePhotoOptions() {
      if (!this.photoSaving) {
        this.showPhotoModal = false;
        this.activePhotoTarget = null;
        this.existingPhotoData = null;
        this.photoModalMode = 'new';
      }
    },
    incrementDuplicate() {
      if (this.existingPhotoData) {
        this.existingPhotoData.count = (this.existingPhotoData.count || 1) + 1;
        this.updatePhotoDuplicate();
      }
    },
    decrementDuplicate() {
      if (this.existingPhotoData && this.existingPhotoData.count > 1) {
        this.existingPhotoData.count -= 1;
        this.updatePhotoDuplicate();
      }
    },
    async updatePhotoDuplicate() {
      if (!this.activePhotoTarget || !this.existingPhotoData) {
        return;
      }

      this.photoSaving = true;
      this.clearMessage();

      try {
        const target = this.activePhotoTarget;
        const collection = this.collections.find((item) => item.id === target.collectionId);

        if (!collection) {
          this.setMessage('Collection not found.');
          return;
        }

        const nextPhotos = this.buildPhotosForCollectionShape(collection, collection.photos);

        if (collection.type === 'single') {
          if (target.rarity === 'r') {
            nextPhotos.r[target.slotIndex] = { ...this.existingPhotoData };
          } else {
            nextPhotos.ssr[target.slotIndex] = { ...this.existingPhotoData };
          }
        } else {
          const personPhotos = nextPhotos[target.personIndex] || { r: [], ssr: [] };

          if (target.rarity === 'r') {
            personPhotos.r[target.slotIndex] = { ...this.existingPhotoData };
          } else {
            personPhotos.ssr[target.slotIndex] = { ...this.existingPhotoData };
          }

          nextPhotos[target.personIndex] = personPhotos;
        }

        const payload = {
          name: collection.name,
          year: collection.year,
          description: collection.description || '',
          type: collection.type,
          single: collection.type === 'single' ? { ...collection.single } : null,
          group: collection.type === 'group' ? collection.group.map((person) => ({ ...person })) : [],
          photos: nextPhotos,
        };

        const result = await window.AuthApi.updateCollection(this.session.email, collection.id, payload);

        if (!result.success) {
          this.setMessage(result.message || 'Failed to update photo.');
          return;
        }

        this.collections = result.collections || [];
      } catch (_) {
        this.setMessage('Failed to update photo.');
      } finally {
        this.photoSaving = false;
      }
    },
    async deletePhoto() {
      if (!this.activePhotoTarget) {
        return;
      }

      const shouldDelete = window.confirm('Delete this photo?');

      if (!shouldDelete) {
        return;
      }

      this.photoSaving = true;
      this.clearMessage();

      try {
        const target = this.activePhotoTarget;
        const collection = this.collections.find((item) => item.id === target.collectionId);

        if (!collection) {
          this.setMessage('Collection not found.');
          return;
        }

        const nextPhotos = this.buildPhotosForCollectionShape(collection, collection.photos);

        if (collection.type === 'single') {
          if (target.rarity === 'r') {
            nextPhotos.r[target.slotIndex] = '';
          } else {
            nextPhotos.ssr[target.slotIndex] = '';
          }
        } else {
          const personPhotos = nextPhotos[target.personIndex] || { r: [], ssr: [] };

          if (target.rarity === 'r') {
            personPhotos.r[target.slotIndex] = '';
          } else {
            personPhotos.ssr[target.slotIndex] = '';
          }

          nextPhotos[target.personIndex] = personPhotos;
        }

        const payload = {
          name: collection.name,
          year: collection.year,
          description: collection.description || '',
          type: collection.type,
          single: collection.type === 'single' ? { ...collection.single } : null,
          group: collection.type === 'group' ? collection.group.map((person) => ({ ...person })) : [],
          photos: nextPhotos,
        };

        const result = await window.AuthApi.updateCollection(this.session.email, collection.id, payload);

        if (!result.success) {
          this.setMessage(result.message || 'Failed to delete photo.');
          return;
        }

        this.collections = result.collections || [];
        this.photoSaving = false;
        this.closePhotoOptions();
        this.setMessage('Photo deleted.', 'success');
      } catch (_) {
        this.setMessage('Failed to delete photo.');
      } finally {
        this.photoSaving = false;
      }
    },
    triggerCamera() {
      if (this.$refs.cameraInput) {
        this.$refs.cameraInput.click();
      }
    },
    triggerUpload() {
      if (this.$refs.uploadInput) {
        this.$refs.uploadInput.click();
      }
    },
    clearPhotoInputs() {
      if (this.$refs.cameraInput) {
        this.$refs.cameraInput.value = '';
      }

      if (this.$refs.uploadInput) {
        this.$refs.uploadInput.value = '';
      }
    },
    readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    },
    onDragEnter(event, collection, rarity, slotIndex, personIndex = null) {
      event.preventDefault();
      event.stopPropagation();
      const key = this.getDragTargetKey(collection.id, rarity, slotIndex, personIndex);
      this.dragOverTarget = key;
    },
    onDragOver(event) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave(event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.target.classList && event.target.classList.contains('photo-placeholder')) {
        this.dragOverTarget = null;
      }
    },
    getDragTargetKey(collectionId, rarity, slotIndex, personIndex) {
      return `${collectionId}_${rarity}_${slotIndex}_${personIndex || 'null'}`;
    },
    async onDrop(event, collection, rarity, slotIndex, personIndex = null) {
      event.preventDefault();
      event.stopPropagation();
      this.dragOverTarget = null;

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) {
        this.setMessage('No files detected.');
        return;
      }

      const file = files[0];
      if (!file || !file.type) {
        this.setMessage('Invalid file.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        this.setMessage('Please drop an image file.');
        return;
      }

      this.activePhotoTarget = {
        collectionId: collection.id,
        rarity,
        slotIndex,
        personIndex,
      };

      this.photoSaving = true;
      this.clearMessage();

      try {
        const imageData = await this.readFileAsDataUrl(file);
        const compressedImageData = await this.compressImage(imageData);
        const target = this.activePhotoTarget;
        const coll = this.collections.find((item) => item.id === target.collectionId);

        if (!coll) {
          this.setMessage('Collection not found.');
          return;
        }

        const nextPhotos = this.buildPhotosForCollectionShape(coll, coll.photos);

        if (coll.type === 'single') {
          if (target.rarity === 'r') {
            nextPhotos.r[target.slotIndex] = { src: compressedImageData, count: 1 };
          } else {
            nextPhotos.ssr[target.slotIndex] = { src: compressedImageData, count: 1 };
          }
        } else {
          const personPhotos = nextPhotos[target.personIndex] || { r: [], ssr: [] };

          if (target.rarity === 'r') {
            personPhotos.r[target.slotIndex] = { src: compressedImageData, count: 1 };
          } else {
            personPhotos.ssr[target.slotIndex] = { src: compressedImageData, count: 1 };
          }

          nextPhotos[target.personIndex] = personPhotos;
        }

        const payload = {
          name: coll.name,
          year: coll.year,
          description: coll.description || '',
          type: coll.type,
          single: coll.type === 'single' ? { ...coll.single } : null,
          group: coll.type === 'group' ? coll.group.map((person) => ({ ...person })) : [],
          photos: nextPhotos,
        };

        const result = await window.AuthApi.updateCollection(this.session.email, coll.id, payload);

        if (!result.success) {
          this.setMessage(result.message || 'Failed to update photo.');
          return;
        }

        this.collections = result.collections || [];
        this.setMessage('Photo updated.', 'success');
      } catch (error) {
        console.error('Drag and drop upload error:', error);
        this.setMessage('Failed to upload photo: ' + (error?.message || 'Unknown error'));
      } finally {
        this.photoSaving = false;
        this.activePhotoTarget = null;
      }
    },
    compressImage(dataUrl) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Resize to max 1920x1080 while maintaining aspect ratio
          const maxWidth = 1920;
          const maxHeight = 1080;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress with decreasing quality until below 2MB
          let quality = 0.85;
          let result = canvas.toDataURL('image/jpeg', quality);

          while (result.length > 2621440 && quality > 0.1) {
            // 2621440 bytes = 2.5 MB (accounting for base64 expansion)
            quality -= 0.1;
            result = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(result);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      });
    },
    resizePhotoArray(existingArray, nextCount) {
      const source = Array.isArray(existingArray) ? existingArray : [];
      return Array.from({ length: Number(nextCount) || 0 }, (_, index) => source[index] || '');
    },
    buildPhotosForCollectionShape(collectionLike, existingPhotos) {
      if (collectionLike.type === 'single') {
        const singlePhotos = existingPhotos && !Array.isArray(existingPhotos) ? existingPhotos : {};
        return {
          r: this.resizePhotoArray(singlePhotos.r, collectionLike.single.rVariety),
          ssr: this.resizePhotoArray(singlePhotos.ssr, collectionLike.single.ssrVariety),
        };
      }

      const groupPhotos = Array.isArray(existingPhotos) ? existingPhotos : [];

      return collectionLike.group.map((person, index) => ({
        r: this.resizePhotoArray(groupPhotos[index]?.r, person.rVariety),
        ssr: this.resizePhotoArray(groupPhotos[index]?.ssr, person.ssrVariety),
      }));
    },
    getPhotoSrc(collection, rarity, slotIndex, personIndex = null) {
      const data = this.getFullPhotoData(collection, rarity, slotIndex, personIndex);
      if (!data) return '';
      if (typeof data === 'string') return data;
      if (typeof data === 'object' && data.src) return data.src;
      return '';
    },
    getPhotoDuplicateCount(collection, rarity, slotIndex, personIndex = null) {
      const data = this.getFullPhotoData(collection, rarity, slotIndex, personIndex);
      if (!data) return 0;
      if (typeof data === 'string') return 1;
      if (typeof data === 'object' && data.src) return data.count || 1;
      return 0;
    },
    async onPhotoSelected(event) {
      const file = event.target?.files?.[0];

      if (!file) {
        return;
      }

      if (!this.activePhotoTarget) {
        this.clearPhotoInputs();
        return;
      }

      this.photoSaving = true;
      this.clearMessage();

      try {
        const imageData = await this.readFileAsDataUrl(file);
        const compressedImageData = await this.compressImage(imageData);
        const target = this.activePhotoTarget;
        const collection = this.collections.find((item) => item.id === target.collectionId);

        if (!collection) {
          this.setMessage('Collection not found.');
          return;
        }

        const nextPhotos = this.buildPhotosForCollectionShape(collection, collection.photos);

        if (collection.type === 'single') {
          if (target.rarity === 'r') {
            nextPhotos.r[target.slotIndex] = { src: compressedImageData, count: 1 };
          } else {
            nextPhotos.ssr[target.slotIndex] = { src: compressedImageData, count: 1 };
          }
        } else {
          const personPhotos = nextPhotos[target.personIndex] || { r: [], ssr: [] };

          if (target.rarity === 'r') {
            personPhotos.r[target.slotIndex] = { src: compressedImageData, count: 1 };
          } else {
            personPhotos.ssr[target.slotIndex] = { src: compressedImageData, count: 1 };
          }

          nextPhotos[target.personIndex] = personPhotos;
        }

        const payload = {
          name: collection.name,
          year: collection.year,
          description: collection.description || '',
          type: collection.type,
          single: collection.type === 'single' ? { ...collection.single } : null,
          group: collection.type === 'group' ? collection.group.map((person) => ({ ...person })) : [],
          photos: nextPhotos,
        };

        const result = await window.AuthApi.updateCollection(this.session.email, collection.id, payload);

        if (!result.success) {
          this.setMessage(result.message || 'Failed to update photo.');
          return;
        }

        this.collections = result.collections || [];
        this.setMessage('Photo updated.', 'success');
        this.photoSaving = false;
        this.clearPhotoInputs();
        setTimeout(() => this.closePhotoOptions(), 500);
      } catch (error) {
        console.error('Photo upload error:', error);
        this.setMessage('Failed to update photo: ' + (error?.message || 'Unknown error'));
      } finally {
        this.photoSaving = false;
        this.clearPhotoInputs();
      }
    },
    resetForm() {
      this.form = {
        name: '',
        year: '',
        description: '',
        type: 'single',
        single: {
          rVariety: 0,
          ssrVariety: 0,
        },
        group: [
          { name: 'A', rVariety: 0, ssrVariety: 0 },
          { name: 'B', rVariety: 0, ssrVariety: 0 },
          { name: 'C', rVariety: 0, ssrVariety: 0 },
        ],
        groupTemplate: {
          rVariety: 0,
          ssrVariety: 0,
        },
      };
    },
    addGroupPerson() {
      const nextLabel = String.fromCharCode(65 + this.form.group.length);
      this.form.group.push({ name: nextLabel, rVariety: 0, ssrVariety: 0 });
    },
    removeGroupPerson(index) {
      if (this.form.group.length <= 1) {
        return;
      }

      this.form.group.splice(index, 1);
    },
    rarityCount(count) {
      return Array.from({ length: Number(count) || 0 }, (_, i) => i + 1);
    },
    normalizeNumber(value) {
      const number = Number(value);
      if (Number.isNaN(number) || number < 0) {
        return 0;
      }
      return Math.floor(number);
    },
    validateForm() {
      if (!this.form.name.trim()) {
        return 'Collection name is required.';
      }

      if (!this.form.year.toString().trim()) {
        return 'Year is required.';
      }

      if (this.form.type === 'single') {
        const rVariety = this.normalizeNumber(this.form.single.rVariety);
        const ssrVariety = this.normalizeNumber(this.form.single.ssrVariety);

        if (rVariety + ssrVariety === 0) {
          return 'Add at least one variety for R or SSR.';
        }

        this.form.single.rVariety = rVariety;
        this.form.single.ssrVariety = ssrVariety;
        return '';
      }

      // For group type
      // When creating (not editing), validate template and at least one person
      if (!this.editingCollectionId) {
        const rVariety = this.normalizeNumber(this.form.groupTemplate.rVariety);
        const ssrVariety = this.normalizeNumber(this.form.groupTemplate.ssrVariety);
        
        if (rVariety + ssrVariety === 0) {
          return 'Add at least one variety for R or SSR.';
        }
        
        if (this.form.group.length === 0) {
          return 'Add at least one person.';
        }
        
        // Check each person has a name
        for (let i = 0; i < this.form.group.length; i += 1) {
          const person = this.form.group[i];
          if (!person.name.trim()) {
            return `Person ${i + 1} needs a name.`;
          }
        }
        
        this.form.groupTemplate.rVariety = rVariety;
        this.form.groupTemplate.ssrVariety = ssrVariety;
        return '';
      }

      // When editing, validate each person
      for (let i = 0; i < this.form.group.length; i += 1) {
        const person = this.form.group[i];
        person.name = person.name.trim();
        person.rVariety = this.normalizeNumber(person.rVariety);
        person.ssrVariety = this.normalizeNumber(person.ssrVariety);

        if (!person.name) {
          return `Person ${i + 1} name is required.`;
        }

        if (person.rVariety + person.ssrVariety === 0) {
          return `Add at least one variety for ${person.name}.`;
        }
      }

      return '';
    },
    async submitCollection() {
      this.clearMessage();
      const validationError = this.validateForm();

      if (validationError) {
        this.setMessage(validationError);
        return;
      }

      this.saving = true;

      try {
        // If creating new group collection, apply template R/SSR to all persons
        let groupData = this.form.group;
        if (this.form.type === 'group' && !this.editingCollectionId) {
          // Apply template R/SSR values to all persons
          groupData = this.form.group.map(person => ({
            name: person.name.trim(),
            rVariety: this.normalizeNumber(this.form.groupTemplate.rVariety),
            ssrVariety: this.normalizeNumber(this.form.groupTemplate.ssrVariety),
          }));
        }
        
        const payload = {
          name: this.form.name.trim(),
          year: this.form.year.toString().trim(),
          description: this.form.description.trim(),
          type: this.form.type,
          single: this.form.type === 'single' ? { ...this.form.single } : null,
          group: this.form.type === 'group' ? groupData.map((person) => ({ ...person })) : [],
        };

        const existingCollection = this.editingCollectionId
          ? this.collections.find((collection) => collection.id === this.editingCollectionId)
          : null;

        payload.photos = this.buildPhotosForCollectionShape(payload, existingCollection?.photos);

        const result = this.editingCollectionId
          ? await window.AuthApi.updateCollection(this.session.email, this.editingCollectionId, payload)
          : await window.AuthApi.createCollection(this.session.email, payload);

        if (!result.success) {
          this.setMessage(result.message || 'Failed to save collection.');
          return;
        }

        this.collections = result.collections || [];
        this.showModal = false;
        this.editingCollectionId = null;
      } catch (_) {
        this.setMessage('Failed to save collection.');
      } finally {
        this.saving = false;
      }
    },
    async deleteCollection(collection) {
      this.clearMessage();
      const shouldDelete = window.confirm(`Delete collection "${collection.name}"?`);

      if (!shouldDelete) {
        return;
      }

      try {
        const result = await window.AuthApi.deleteCollection(this.session.email, collection.id);

        if (!result.success) {
          this.setMessage(result.message || 'Failed to delete collection.');
          return;
        }

        this.collections = result.collections || [];
        this.setMessage('Collection deleted.', 'success');
      } catch (_) {
        this.setMessage('Failed to delete collection.');
      }
    },
    logout() {
      window.AuthApi.logout();
      window.location.href = './index.html';
    },
    openSettings() {
      this.clearMessage();
      this.displayNameForm = this.session.displayName || '';
      this.oldPin = '';
      this.newPin = '';
      this.confirmPin = '';
      this.showSettings = true;
    },
    closeSettings() {
      this.showSettings = false;
      this.displayNameForm = '';
      this.oldPin = '';
      this.newPin = '';
      this.confirmPin = '';
      this.activePinField = null;
      this.pinInput = '';
      this.clearMessage();
    },
    startEditPin(field) {
      this.activePinField = field;
      this.pinInput = this[field];
      this.clearMessage();
    },
    onPinPadPress(value) {
      this.clearMessage();

      if (value === 'del') {
        this.pinInput = this.pinInput.slice(0, -1);
        return;
      }

      if (value === 'clear') {
        this.pinInput = '';
        return;
      }

      if (this.pinInput.length < 6) {
        this.pinInput += value;
      }
    },
    confirmPinField() {
      if (this.activePinField && this.pinInput.length === 6) {
        this[this.activePinField] = this.pinInput;
        this.activePinField = null;
        this.pinInput = '';
      }
    },
    cancelPinEdit() {
      this.activePinField = null;
      this.pinInput = '';
      this.clearMessage();
    },
    async saveDisplayName() {
      this.clearMessage();
      const newName = this.displayNameForm.trim();

      if (!newName) {
        this.setMessage('Display name cannot be empty.');
        return;
      }

      if (newName.length < 2) {
        this.setMessage('Display name must be at least 2 characters.');
        return;
      }

      this.saving = true;

      try {
        const result = await window.AuthApi.updateDisplayName(this.session.email, newName);

        if (!result.success) {
          this.setMessage(result.message || 'Failed to update display name.');
          return;
        }

        this.session.displayName = newName;
        this.displayNameForm = newName;
        this.setMessage('Display name updated successfully.', 'success');
      } catch (_) {
        this.setMessage('Error updating display name.');
      } finally {
        this.saving = false;
      }
    },
    async savePin() {
      this.clearMessage();

      if (!this.oldPin || !this.newPin || !this.confirmPin) {
        this.setMessage('Please fill in all PIN fields.');
        return;
      }

      if (this.oldPin.length !== 6) {
        this.setMessage('Current PIN must be 6 digits.');
        return;
      }

      if (this.newPin.length !== 6) {
        this.setMessage('New PIN must be 6 digits.');
        return;
      }

      if (this.newPin !== this.confirmPin) {
        this.setMessage('New PIN and confirmation do not match.');
        return;
      }

      if (this.oldPin === this.newPin) {
        this.setMessage('New PIN must be different from current PIN.');
        return;
      }

      this.saving = true;

      try {
        const result = await window.AuthApi.updatePin(this.session.email, this.oldPin, this.newPin);

        if (!result.success) {
          this.setMessage(result.message || 'Failed to update PIN.');
          this.oldPin = '';
          this.newPin = '';
          this.confirmPin = '';
          return;
        }

        this.setMessage('PIN updated successfully.', 'success');
        setTimeout(() => {
          this.closeSettings();
        }, 1200);
      } catch (_) {
        this.setMessage('Error updating PIN.');
      } finally {
        this.saving = false;
      }
    },
  },
  template: `
    <div class="dashboard-page" v-if="session">
      <div class="card dashboard-card">
        <div class="dashboard-header">
          <div>
            <h1>{{ session.displayName }}'s Collections</h1>
            <p class="subtitle">{{ session.email }}</p>
          </div>
          <div class="dashboard-actions">
            <button class="btn btn-primary" @click="openModal">New Collection</button>
            <button class="btn btn-secondary" @click="openSettings">Settings</button>
            <button class="btn btn-secondary" @click="logout">Logout</button>
          </div>
        </div>

        <p v-if="message" :class="['message', messageType]">{{ message }}</p>

        <div class="empty-state" v-if="collections.length === 0">
          No collections yet. Click <strong>New Collection</strong> to create one.
        </div>

        <div class="collection-list" v-else>
          <div class="collection-item" v-for="collection in collections" :key="collection.id">
            <div class="collection-header" @click="toggleCollection(collection.id)">
              <div class="collection-header-left">
                <h2>{{ collection.name }}</h2>
                <p class="collection-meta">{{ collection.year }} • {{ collection.type }}</p>
              </div>
              <div class="collection-toggle-arrow">
                <span>{{ expandedCollections[collection.id] ? '▼' : '▶' }}</span>
              </div>
            </div>

            <div v-if="expandedCollections[collection.id]" class="collection-content">
              <div class="collection-actions-bar">
                <button type="button" class="link-btn" @click="startEdit(collection)">Edit</button>
                <button type="button" class="link-btn link-btn-danger" @click="deleteCollection(collection)">Delete</button>
              </div>

              <p class="collection-desc" v-if="collection.description">{{ collection.description }}</p>

            <div v-if="collection.type === 'single'" class="rarity-block">
              <div class="placeholder-row">
                <div class="photo-placeholder rarity-r" v-for="index in rarityCount(collection.single.rVariety)" :key="'r_' + collection.id + '_' + index" @click="openPhotoOptions(collection, 'r', index - 1)" @dragenter="onDragEnter($event, collection, 'r', index - 1)" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop($event, collection, 'r', index - 1)" :class="{ 'drag-over': dragOverTarget === getDragTargetKey(collection.id, 'r', index - 1) }">
                  <img v-if="getPhotoSrc(collection, 'r', index - 1)" :src="getPhotoSrc(collection, 'r', index - 1)" class="photo-image" alt="Collection photo" />
                  <div v-else class="photo-placeholder-empty">Tap to add</div>
                  <span v-if="getPhotoDuplicateCount(collection, 'r', index - 1) > 0" class="duplicate-badge">{{ getPhotoDuplicateCount(collection, 'r', index - 1) }}</span>
                  <span class="rarity-badge">R</span>
                </div>
                <div class="photo-placeholder rarity-ssr" v-for="index in rarityCount(collection.single.ssrVariety)" :key="'ssr_' + collection.id + '_' + index" @click="openPhotoOptions(collection, 'ssr', index - 1)" @dragenter="onDragEnter($event, collection, 'ssr', index - 1)" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop($event, collection, 'ssr', index - 1)" :class="{ 'drag-over': dragOverTarget === getDragTargetKey(collection.id, 'ssr', index - 1) }">
                  <img v-if="getPhotoSrc(collection, 'ssr', index - 1)" :src="getPhotoSrc(collection, 'ssr', index - 1)" class="photo-image" alt="Collection photo" />
                  <div v-else class="photo-placeholder-empty">Tap to add</div>
                  <span v-if="getPhotoDuplicateCount(collection, 'ssr', index - 1) > 0" class="duplicate-badge">{{ getPhotoDuplicateCount(collection, 'ssr', index - 1) }}</span>
                  <span class="rarity-badge">SSR</span>
                </div>
              </div>
            </div>

            <div v-else class="rarity-block">
              <div class="group-person" v-for="(person, personIndex) in collection.group" :key="collection.id + '_' + personIndex">
                <div class="person-name">{{ person.name }}</div>
                <div class="placeholder-row">
                  <div class="photo-placeholder rarity-r" v-for="index in rarityCount(person.rVariety)" :key="'gr_' + collection.id + '_' + personIndex + '_' + index" @click="openPhotoOptions(collection, 'r', index - 1, personIndex)" @dragenter="onDragEnter($event, collection, 'r', index - 1, personIndex)" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop($event, collection, 'r', index - 1, personIndex)" :class="{ 'drag-over': dragOverTarget === getDragTargetKey(collection.id, 'r', index - 1, personIndex) }">
                    <img v-if="getPhotoSrc(collection, 'r', index - 1, personIndex)" :src="getPhotoSrc(collection, 'r', index - 1, personIndex)" class="photo-image" alt="Collection photo" />
                    <div v-else class="photo-placeholder-empty">Tap to add</div>
                    <span v-if="getPhotoDuplicateCount(collection, 'r', index - 1, personIndex) > 0" class="duplicate-badge">{{ getPhotoDuplicateCount(collection, 'r', index - 1, personIndex) }}</span>
                    <span class="rarity-badge">R</span>
                  </div>
                  <div class="photo-placeholder rarity-ssr" v-for="index in rarityCount(person.ssrVariety)" :key="'gssr_' + collection.id + '_' + personIndex + '_' + index" @click="openPhotoOptions(collection, 'ssr', index - 1, personIndex)" @dragenter="onDragEnter($event, collection, 'ssr', index - 1, personIndex)" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop($event, collection, 'ssr', index - 1, personIndex)" :class="{ 'drag-over': dragOverTarget === getDragTargetKey(collection.id, 'ssr', index - 1, personIndex) }">
                    <img v-if="getPhotoSrc(collection, 'ssr', index - 1, personIndex)" :src="getPhotoSrc(collection, 'ssr', index - 1, personIndex)" class="photo-image" alt="Collection photo" />
                    <div v-else class="photo-placeholder-empty">Tap to add</div>
                    <span v-if="getPhotoDuplicateCount(collection, 'ssr', index - 1, personIndex) > 0" class="duplicate-badge">{{ getPhotoDuplicateCount(collection, 'ssr', index - 1, personIndex) }}</span>
                    <span class="rarity-badge">SSR</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" v-if="showModal">
        <div class="modal-card" @click.stop>
          <h2>{{ editingCollectionId ? 'Edit Collection' : 'New Collection' }}</h2>

          <div class="stack">
            <div>
              <label>Collection Name *</label>
              <input type="text" v-model="form.name" placeholder="Collection name" />
            </div>

            <div>
              <label>Year *</label>
              <input type="number" v-model="form.year" placeholder="2026" min="1900" max="2100" />
            </div>

            <div>
              <label>Description</label>
              <textarea v-model="form.description" placeholder="Optional"></textarea>
            </div>

            <div>
              <label>Type *</label>
              <div class="type-row">
                <label class="radio-inline">
                  <input type="radio" value="single" v-model="form.type" /> Single
                </label>
                <label class="radio-inline">
                  <input type="radio" value="group" v-model="form.type" /> Group
                </label>
              </div>
            </div>

            <div v-if="form.type === 'single'" class="builder-box">
              <label>Rarity Variety</label>
              <div class="two-col">
                <div>
                  <label>R</label>
                  <input type="number" min="0" v-model="form.single.rVariety" />
                </div>
                <div>
                  <label>SSR</label>
                  <input type="number" min="0" v-model="form.single.ssrVariety" />
                </div>
              </div>
            </div>

            <div v-else class="builder-box">
              <label>People and Rarity Variety</label>
              
              <!-- Simple creation mode: separate name inputs with shared R/SSR -->
              <div v-if="!editingCollectionId">
                <div class="two-col" style="margin-bottom: 1rem;">
                  <div>
                    <label>R per person</label>
                    <input type="number" min="0" v-model="form.groupTemplate.rVariety" />
                  </div>
                  <div>
                    <label>SSR per person</label>
                    <input type="number" min="0" v-model="form.groupTemplate.ssrVariety" />
                  </div>
                </div>

                <div class="group-builder" v-for="(person, index) in form.group" :key="index" style="margin-bottom: 1rem;">
                  <div class="group-title">
                    <strong>Person {{ index + 1 }}</strong>
                    <button type="button" class="link-btn" @click="removeGroupPerson(index)" v-if="form.group.length > 1">Remove</button>
                  </div>

                  <div>
                    <label>Name</label>
                    <input type="text" v-model="person.name" placeholder="A" />
                  </div>
                </div>
                
                <button type="button" class="btn btn-secondary" @click="addGroupPerson">Add Person</button>
              </div>

              <!-- Detailed edit mode: individual person settings -->
              <div v-else>
                <div class="group-builder" v-for="(person, index) in form.group" :key="index" style="margin-bottom: 1rem;">
                  <div class="group-title">
                    <strong>Person {{ index + 1 }}</strong>
                    <button type="button" class="link-btn" @click="removeGroupPerson(index)" v-if="form.group.length > 1">Remove</button>
                  </div>

                  <div>
                    <label>Name</label>
                    <input type="text" v-model="person.name" placeholder="A" />
                  </div>

                  <div class="two-col">
                    <div>
                      <label>R</label>
                      <input type="number" min="0" v-model="person.rVariety" />
                    </div>
                    <div>
                      <label>SSR</label>
                      <input type="number" min="0" v-model="person.ssrVariety" />
                    </div>
                  </div>
                </div>
                <button type="button" class="btn btn-secondary" @click="addGroupPerson">Add Person</button>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal" :disabled="saving">Cancel</button>
            <button type="button" class="btn btn-primary" @click="submitCollection" :disabled="saving">
              {{ saving ? 'Saving...' : (editingCollectionId ? 'Save Changes' : 'Create Collection') }}
            </button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" v-if="showPhotoModal">
        <div class="modal-card photo-modal-card" @click.stop>
          <h2 v-if="photoModalMode === 'new'">Add Photo</h2>
          <h2 v-else>Manage Photo</h2>
          <p class="subtitle" v-if="photoModalMode === 'new'">Choose how to add image for this slot. You can also drag and drop directly on the placeholder.</p>
          <p class="subtitle" v-else>Edit duplicate count or delete this photo.</p>

          <div class="stack" v-if="photoModalMode === 'new'">
            <button type="button" class="btn btn-primary" @click="triggerCamera" :disabled="photoSaving">Take Photo</button>
            <button type="button" class="btn btn-secondary" @click="triggerUpload" :disabled="photoSaving">Upload from Device</button>
            <button type="button" class="btn btn-secondary" @click="closePhotoOptions" :disabled="photoSaving">Cancel</button>
          </div>

          <div class="stack" v-else>
            <div class="edit-photo-preview">
              <img v-if="existingPhotoData?.src" :src="existingPhotoData.src" alt="Photo preview" />
            </div>

            <div class="duplicate-controls">
              <label>Mark as duplicate</label>
              <div class="duplicate-buttons">
                <button type="button" class="btn-icon" @click="decrementDuplicate" :disabled="!existingPhotoData || existingPhotoData.count <= 1 || photoSaving">−</button>
                <span class="duplicate-count">{{ existingPhotoData?.count || 1 }}</span>
                <button type="button" class="btn-icon" @click="incrementDuplicate" :disabled="!existingPhotoData || photoSaving">+</button>
              </div>
            </div>

            <button type="button" class="btn btn-secondary" @click="deletePhoto" :disabled="photoSaving">Delete Photo</button>
            <button type="button" class="btn btn-secondary" @click="closePhotoOptions" :disabled="photoSaving">Close</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" v-if="showSettings">
        <div class="modal-card" @click.stop>
          <h2>Account Settings</h2>

          <div class="stack">
            <div class="settings-section">
              <h3>Change Display Name</h3>
              <div>
                <label for="displayNameInput">New Display Name</label>
                <input id="displayNameInput" type="text" v-model="displayNameForm" placeholder="Your name" />
              </div>
              <button type="button" class="btn btn-primary" @click="saveDisplayName" :disabled="saving">
                {{ saving ? 'Updating...' : 'Update Display Name' }}
              </button>
            </div>

            <hr class="settings-divider" />

            <div class="settings-section">
              <h3>Change PIN</h3>
              
              <div v-if="!activePinField" class="pin-fields">
                <div class="pin-field-display">
                  <label>Current PIN</label>
                  <button type="button" class="pin-display" @click="startEditPin('oldPin')">
                    {{ oldPin ? '••••••' : 'Tap to enter' }}
                  </button>
                </div>
                <div class="pin-field-display">
                  <label>New PIN</label>
                  <button type="button" class="pin-display" @click="startEditPin('newPin')">
                    {{ newPin ? '••••••' : 'Tap to enter' }}
                  </button>
                </div>
                <div class="pin-field-display">
                  <label>Confirm PIN</label>
                  <button type="button" class="pin-display" @click="startEditPin('confirmPin')">
                    {{ confirmPin ? '••••••' : 'Tap to enter' }}
                  </button>
                </div>
                <button type="button" class="btn btn-primary" @click="savePin" :disabled="saving">
                  {{ saving ? 'Updating...' : 'Update PIN' }}
                </button>
              </div>
              
              <div v-else class="pin-numpad-container">
                <label>
                  {{ activePinField === 'oldPin' ? 'Current PIN' : activePinField === 'newPin' ? 'New PIN' : 'Confirm PIN' }}
                </label>
                <div class="pin-dots">
                  <div class="dot" v-for="i in 6" :key="i">{{ pinInput[i - 1] ? '•' : '' }}</div>
                </div>
                <div class="pin-pad">
                  <button class="pin-key" @click="onPinPadPress('1')">1</button>
                  <button class="pin-key" @click="onPinPadPress('2')">2</button>
                  <button class="pin-key" @click="onPinPadPress('3')">3</button>
                  <button class="pin-key" @click="onPinPadPress('4')">4</button>
                  <button class="pin-key" @click="onPinPadPress('5')">5</button>
                  <button class="pin-key" @click="onPinPadPress('6')">6</button>
                  <button class="pin-key" @click="onPinPadPress('7')">7</button>
                  <button class="pin-key" @click="onPinPadPress('8')">8</button>
                  <button class="pin-key" @click="onPinPadPress('9')">9</button>
                  <button class="pin-key" @click="onPinPadPress('clear')">Clear</button>
                  <button class="pin-key" @click="onPinPadPress('0')">0</button>
                  <button class="pin-key" @click="onPinPadPress('del')">⌫</button>
                </div>
                <div class="numpad-actions">
                  <button type="button" class="btn btn-secondary" @click="cancelPinEdit">Cancel</button>
                  <button type="button" class="btn btn-primary" @click="confirmPinField" :disabled="pinInput.length !== 6">Confirm</button>
                </div>
              </div>
            </div>
          </div>

          <p v-if="message" :class="['message', messageType]">{{ message }}</p>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeSettings" :disabled="saving">Close</button>
          </div>
        </div>
      </div>

      <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="hidden-file" @change="onPhotoSelected" />
      <input ref="uploadInput" type="file" accept="image/*" class="hidden-file" @change="onPhotoSelected" />
    </div>
  `,
}).mount('#app');

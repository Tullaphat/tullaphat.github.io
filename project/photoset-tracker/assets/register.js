const { createApp } = Vue;

createApp({
  data() {
    return {
      email: '',
      displayName: '',
      pin: '',
      loading: false,
      emailReady: false,
      displayNameReady: false,
      message: '',
      messageType: '',
    };
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
    async validateEmail() {
      this.clearMessage();
      const email = this.email.trim();

      if (!email) {
        this.setMessage('Please enter your email.');
        return;
      }

      this.loading = true;

      try {
        const result = await window.AuthApi.checkEmailExists(email);

        if (result.exists) {
          this.setMessage('Email is already taken.');
          return;
        }

        this.email = email;
        this.emailReady = true;
      } catch (_) {
        this.setMessage('Unable to validate email right now.');
      } finally {
        this.loading = false;
      }
    },
    validateDisplayName() {
      this.clearMessage();
      const name = this.displayName.trim();

      if (!name) {
        this.setMessage('Please enter your display name.');
        return;
      }

      if (name.length < 2) {
        this.setMessage('Display name must be at least 2 characters.');
        return;
      }

      this.displayName = name;
      this.displayNameReady = true;
    },
    goBackToEmail() {
      this.clearMessage();
      this.displayNameReady = false;
      this.pin = '';
    },
    goBackToDisplayName() {
      this.clearMessage();
      this.emailReady = false;
      this.displayName = '';
      this.displayNameReady = false;
      this.pin = '';
    },
    onPinPress(value) {
      this.clearMessage();

      if (value === 'del') {
        this.pin = this.pin.slice(0, -1);
        return;
      }

      if (value === 'clear') {
        this.pin = '';
        return;
      }

      if (this.pin.length < 6) {
        this.pin += value;
      }

      if (this.pin.length === 6) {
        this.submitRegistration();
      }
    },
    async submitRegistration() {
      if (this.pin.length !== 6) {
        this.setMessage('PIN must be 6 digits.');
        return;
      }

      this.loading = true;

      try {
        const result = await window.AuthApi.registerUser(this.email, this.pin, this.displayName);

        if (!result.success) {
          this.setMessage(result.message || 'Registration failed.');
          this.pin = '';
          return;
        }

        this.setMessage('Registration successful. Redirecting to login...', 'success');
        setTimeout(() => {
          window.location.href = './index.html';
        }, 1200);
      } catch (_) {
        this.setMessage('Registration failed. Please try again.');
      } finally {
        this.loading = false;
      }
    },
  },
  template: `
    <div class="card">
      <h1>Register</h1>
      <p class="subtitle">Create a new account with email and 6-digit PIN.</p>

      <div class="stack" v-if="!emailReady">
        <div>
          <label for="email">Email</label>
          <input id="email" type="email" v-model="email" placeholder="you@example.com" autocomplete="email" />
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="validateEmail">
          {{ loading ? 'Checking...' : 'Check Email' }}
        </button>
      </div>

      <div v-else-if="!displayNameReady" class="stack">
        <div>
          <label for="displayName">Display Name</label>
          <input id="displayName" type="text" v-model="displayName" placeholder="Your name" />
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="validateDisplayName">
          Continue
        </button>
        <button class="btn btn-secondary" @click="goBackToEmail">
          Back
        </button>
      </div>

      <div v-else class="pin-wrapper">
        <label>Set your 6-digit PIN for {{ displayName }}</label>

        <div class="pin-dots">
          <div class="dot" v-for="i in 6" :key="i">{{ pin[i - 1] ? '•' : '' }}</div>
        </div>

        <div class="pin-pad">
          <button class="pin-key" @click="onPinPress('1')">1</button>
          <button class="pin-key" @click="onPinPress('2')">2</button>
          <button class="pin-key" @click="onPinPress('3')">3</button>
          <button class="pin-key" @click="onPinPress('4')">4</button>
          <button class="pin-key" @click="onPinPress('5')">5</button>
          <button class="pin-key" @click="onPinPress('6')">6</button>
          <button class="pin-key" @click="onPinPress('7')">7</button>
          <button class="pin-key" @click="onPinPress('8')">8</button>
          <button class="pin-key" @click="onPinPress('9')">9</button>
          <button class="pin-key" @click="onPinPress('clear')">Clear</button>
          <button class="pin-key" @click="onPinPress('0')">0</button>
          <button class="pin-key" @click="onPinPress('del')">⌫</button>
        </div>

        <button class="btn btn-secondary" @click="goBackToDisplayName">
          Back
        </button>
      </div>

      <p v-if="message" :class="['message', messageType]">{{ message }}</p>

      <div class="footer-link">
        Have account? <a href="./index.html">Back to login</a>
      </div>
    </div>
  `,
}).mount('#app');

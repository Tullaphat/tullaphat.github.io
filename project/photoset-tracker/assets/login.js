const { createApp } = Vue;

createApp({
  data() {
    return {
      email: '',
      normalizedEmail: '',
      pin: '',
      loading: false,
      emailVerified: false,
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
    async checkEmail() {
      this.clearMessage();
      const email = this.email.trim();

      if (!email) {
        this.setMessage('Please enter your email.');
        return;
      }

      this.loading = true;

      try {
        const result = await window.AuthApi.checkEmailExists(email);

        if (!result.exists) {
          this.setMessage('Email does not exist. Please register first.');
          return;
        }

        this.normalizedEmail = email;
        this.emailVerified = true;
      } catch (_) {
        this.setMessage('Unable to check email right now.');
      } finally {
        this.loading = false;
      }
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
        this.submitPin();
      }
    },
    async submitPin() {
      if (this.pin.length !== 6) {
        this.setMessage('PIN must be 6 digits.');
        return;
      }

      this.loading = true;

      try {
        const result = await window.AuthApi.verifyPin(this.normalizedEmail, this.pin);

        if (!result.success) {
          this.setMessage(result.message || 'Invalid PIN.');
          this.pin = '';
          return;
        }

        window.location.href = './dashboard.html';
      } catch (_) {
        this.setMessage('Login failed. Please try again.');
      } finally {
        this.loading = false;
      }
    },
    cancelLogin() {
      window.AuthApi.logout();
      this.clearMessage();
      this.pin = '';
      this.normalizedEmail = '';
      this.email = '';
      this.emailVerified = false;
      this.loading = false;
    },
  },
  template: `
    <div class="card">
      <h1>Login</h1>
      <p class="subtitle">Enter your email and PIN to access your dashboard.</p>

      <div class="stack" v-if="!emailVerified">
        <div>
          <label for="email">Email</label>
          <input id="email" type="email" v-model="email" placeholder="you@example.com" autocomplete="email" />
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="checkEmail">
          {{ loading ? 'Checking...' : 'Continue' }}
        </button>
      </div>

      <div v-else class="pin-wrapper">
        <label>Enter 6-digit PIN for {{ normalizedEmail }}</label>

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
      </div>

      <p v-if="message" :class="['message', messageType]">{{ message }}</p>

      <div class="footer-link" v-if="!emailVerified">
        No account? <a href="./register.html">Register</a>
      </div>
      <div class="footer-link" v-else>
        <button type="button" class="btn btn-secondary" @click="cancelLogin">Logout</button>
      </div>
    </div>
  `,
}).mount('#app');

// API Configuration
const API_BASE_URL = '/api';

// API Helper Functions
class API {
  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  static async get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  static async post(endpoint, body, options = {}) {
    return this.request(endpoint, { method: 'POST', body, ...options });
  }

  static async put(endpoint, body, options = {}) {
    return this.request(endpoint, { method: 'PUT', body, ...options });
  }

  static async patch(endpoint, body, options = {}) {
    return this.request(endpoint, { method: 'PATCH', body, ...options });
  }

  static async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }
}

// Registration API
class RegistrationAPI {
  static async register(registrationData) {
    return API.post('/registration', registrationData);
  }

  static async getRegistrations(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return API.get(`/registration${queryString ? '?' + queryString : ''}`);
  }

  static async getRegistration(id) {
    return API.get(`/registration/${id}`);
  }

  static async updateStatus(id, status) {
    return API.patch(`/registration/${id}/status`, { status });
  }
}

// Contact API
class ContactAPI {
  static async sendMessage(contactData) {
    return API.post('/contact', contactData);
  }

  static async getMessages(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return API.get(`/contact${queryString ? '?' + queryString : ''}`);
  }

  static async getMessage(id) {
    return API.get(`/contact/${id}`);
  }

  static async updateMessageStatus(id, status) {
    return API.patch(`/contact/${id}/status`, { status });
  }
}

// Sections API
class SectionsAPI {
  static async getSections() {
    return API.get('/sections');
  }

  static async getSection(identifier) {
    return API.get(`/sections/${identifier}`);
  }

  static async getSectionStudents(sectionName, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return API.get(`/sections/${sectionName}/students${queryString ? '?' + queryString : ''}`);
  }

  static async getSectionStats(sectionName) {
    return API.get(`/sections/${sectionName}/stats`);
  }
}

// Admin API
class AdminAPI {
  static async login(credentials) {
    return API.post('/admin/login', credentials);
  }

  static async getDashboard() {
    return API.get('/admin/dashboard');
  }

  static async getProfile() {
    return API.get('/admin/profile');
  }

  static async updateProfile(profileData) {
    return API.put('/admin/profile', profileData);
  }

  static async exportData(type, format = 'json') {
    return API.get(`/admin/export/${type}?format=${format}`);
  }
}

// Utility Functions
const showNotification = (message, type = 'info') => {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;

  // Add styles if not already present
  if (!document.querySelector('#notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
      }
      
      .notification-success { background: #d4edda; color: #155724; border-left: 4px solid #28a745; }
      .notification-error { background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; }
      .notification-warning { background: #fff3cd; color: #856404; border-left: 4px solid #ffc107; }
      .notification-info { background: #d1ecf1; color: #0c5460; border-left: 4px solid #17a2b8; }
      
      .notification-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .notification-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        margin-left: 10px;
        opacity: 0.7;
      }
      
      .notification-close:hover { opacity: 1; }
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styles);
  }

  // Add to page
  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);

  // Close button functionality
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });
};

const showLoading = (show = true) => {
  let loader = document.querySelector('#api-loader');
  
  if (show) {
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'api-loader';
      loader.innerHTML = `
        <div class="loader-backdrop">
          <div class="loader-spinner">
            <div class="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      `;
      
      // Add loader styles
      if (!document.querySelector('#loader-styles')) {
        const styles = document.createElement('style');
        styles.id = 'loader-styles';
        styles.textContent = `
          .loader-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
          }
          
          .loader-spinner {
            background: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
          }
          
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #1a5e3c;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(styles);
      }
      
      document.body.appendChild(loader);
    }
  } else {
    if (loader) {
      loader.remove();
    }
  }
};

// Export for use in other scripts
window.API = API;
window.RegistrationAPI = RegistrationAPI;
window.ContactAPI = ContactAPI;
window.SectionsAPI = SectionsAPI;
window.AdminAPI = AdminAPI;
window.showNotification = showNotification;
window.showLoading = showLoading;
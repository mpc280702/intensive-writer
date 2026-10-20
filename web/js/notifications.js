/* Intensive Writer - Notification System */
(function (window) {
  'use strict';

  const STORAGE_KEY = 'iw_notifications_v1';
  const READ_KEY = 'iw_read_notifications_v1';

  // Default curated notifications for IELTS students
  const DEFAULT_NOTIFICATIONS = [
    {
      id: 'notif_welcome',
      title: 'Chào mừng bạn đến với Intensive Writer!',
      message: 'Bắt đầu hành trình chinh phục IELTS Task 2 với phương pháp Scaffold: Dàn ý → Đoạn văn → AI Feedback.',
      time: 'Vừa xong',
      timestamp: Date.now(),
      icon: '🌻',
      color: '#FEF3C7',
      category: 'system'
    },
    {
      id: 'notif_weekly_goal',
      title: 'Mục tiêu tuần: Nuôi dưỡng vườn hoa',
      message: 'Luyện viết ít nhất 2 bài Task 2 trong tuần này để mở khóa cấp độ Hướng Dương nở rộ trên Bảng điều khiển.',
      time: 'Hôm nay',
      timestamp: Date.now() - 3600000 * 2,
      icon: '🎯',
      color: '#E0E7FF',
      category: 'study'
    },
    {
      id: 'notif_writing_tip',
      title: 'Mẹo tăng Band Lexical & Grammar',
      message: 'Hãy thử áp dụng mục "Sentence Templates" ở từng khối viết để nâng cấp cấu trúc câu phức và từ vựng học thuật.',
      time: 'Hôm qua',
      timestamp: Date.now() - 3600000 * 24,
      icon: '💡',
      color: '#DCFCE7',
      category: 'tip'
    },
    {
      id: 'notif_ai_ready',
      title: 'Trợ lý AI sẵn sàng phân tích bài viết',
      message: 'Hệ thống AI sẽ chỉ ra lỗi ngữ pháp cụ thể, câu sửa mẫu và tổng hợp các Collocation chất lượng bạn đã dùng.',
      time: '3 ngày trước',
      timestamp: Date.now() - 3600000 * 72,
      icon: '🤖',
      color: '#F3E8FF',
      category: 'ai'
    }
  ];

  class NotificationService {
    constructor() {
      this.notifications = [];
      this.readIds = new Set();
      this.currentFilter = 'all'; // 'all' or 'unread'
      this.isOpen = false;
      this.dom = {};
    }

    init() {
      this.loadStorage();
      this.cacheDom();
      this.bindEvents();
      this.render();
    }

    loadStorage() {
      try {
        const storedRead = localStorage.getItem(READ_KEY);
        if (storedRead) {
          this.readIds = new Set(JSON.parse(storedRead));
        }
      } catch (err) {
        console.warn('[notifications] Failed to load read states:', err);
        this.readIds = new Set();
      }

      try {
        const customNotifs = localStorage.getItem(STORAGE_KEY);
        if (customNotifs) {
          const parsed = JSON.parse(customNotifs);
          // Combine defaults and custom (avoiding duplicate IDs)
          const ids = new Set(parsed.map(n => n.id));
          const defaults = DEFAULT_NOTIFICATIONS.filter(n => !ids.has(n.id));
          this.notifications = [...parsed, ...defaults];
        } else {
          this.notifications = [...DEFAULT_NOTIFICATIONS];
        }
      } catch (err) {
        console.warn('[notifications] Failed to load custom notifications:', err);
        this.notifications = [...DEFAULT_NOTIFICATIONS];
      }

      // Sort newest first
      this.notifications.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    saveRead() {
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(Array.from(this.readIds)));
      } catch (err) {
        console.warn('[notifications] Failed to save read states:', err);
      }
    }

    saveNotifications() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
      } catch (err) {
        console.warn('[notifications] Failed to save notifications:', err);
      }
    }

    cacheDom() {
      this.dom.btn = document.getElementById('notificationBtn');
      this.dom.badge = document.getElementById('notifBadge');
      this.dom.dropdown = document.getElementById('notifDropdown');
      this.dom.list = document.getElementById('notifList');
      this.dom.unreadCount = document.getElementById('notifUnreadBadge');
      this.dom.markAllBtn = document.getElementById('notifMarkAllReadBtn');
      this.dom.wrapper = document.getElementById('notifWrapper');
      this.dom.filterTabs = document.querySelectorAll('.notif-tab');
    }

    bindEvents() {
      if (this.dom.btn) {
        this.dom.btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleDropdown();
        });
      }

      if (this.dom.markAllBtn) {
        this.dom.markAllBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.markAllAsRead();
        });
      }

      if (this.dom.filterTabs) {
        this.dom.filterTabs.forEach((tab) => {
          tab.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setFilter(tab.dataset.filter);
          });
        });
      }

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (this.isOpen && this.dom.wrapper && !this.dom.wrapper.contains(e.target)) {
          this.closeDropdown();
        }
      });

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeDropdown();
        }
      });
    }

    toggleDropdown() {
      if (this.isOpen) {
        this.closeDropdown();
      } else {
        this.openDropdown();
      }
    }

    openDropdown() {
      if (!this.dom.dropdown) return;
      this.isOpen = true;
      this.dom.dropdown.classList.add('show');
      this.dom.dropdown.setAttribute('aria-hidden', 'false');
      if (this.dom.btn) {
        this.dom.btn.setAttribute('aria-expanded', 'true');
        this.dom.btn.classList.add('active');
      }
    }

    closeDropdown() {
      if (!this.dom.dropdown) return;
      this.isOpen = false;
      this.dom.dropdown.classList.remove('show');
      this.dom.dropdown.setAttribute('aria-hidden', 'true');
      if (this.dom.btn) {
        this.dom.btn.setAttribute('aria-expanded', 'false');
        this.dom.btn.classList.remove('active');
      }
    }

    setFilter(filter) {
      this.currentFilter = filter || 'all';
      if (this.dom.filterTabs) {
        this.dom.filterTabs.forEach((tab) => {
          tab.classList.toggle('active', tab.dataset.filter === this.currentFilter);
        });
      }
      this.renderList();
    }

    markAsRead(id) {
      if (!id || this.readIds.has(id)) return;
      this.readIds.add(id);
      this.saveRead();
      this.render();
    }

    markAllAsRead() {
      this.notifications.forEach((n) => this.readIds.add(n.id));
      this.saveRead();
      this.render();
      this.showToast('Đã đánh dấu tất cả thông báo là đã đọc');
    }

    getUnreadCount() {
      return this.notifications.filter((n) => !this.readIds.has(n.id)).length;
    }

    addNotification({ id, title, message, time, icon, color, category }) {
      const newNotif = {
        id: id || 'notif_' + Date.now(),
        title: title || 'Thông báo mới',
        message: message || '',
        time: time || 'Vừa xong',
        timestamp: Date.now(),
        icon: icon || '🔔',
        color: color || '#FEF3C7',
        category: category || 'general'
      };

      this.notifications.unshift(newNotif);
      this.saveNotifications();
      this.render();
      this.showToast(newNotif.title);
    }

    render() {
      const unreadCount = this.getUnreadCount();

      // Update badge on button
      if (this.dom.badge) {
        if (unreadCount > 0) {
          this.dom.badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
          this.dom.badge.style.display = 'flex';
          this.dom.badge.classList.add('has-unread');
        } else {
          this.dom.badge.textContent = '0';
          this.dom.badge.style.display = 'none';
          this.dom.badge.classList.remove('has-unread');
        }
      }

      // Update header counter
      if (this.dom.unreadCount) {
        this.dom.unreadCount.textContent = unreadCount > 0 ? `${unreadCount} mới` : '0 mới';
        this.dom.unreadCount.style.display = unreadCount > 0 ? 'inline-block' : 'none';
      }

      // Update mark all button visibility/state
      if (this.dom.markAllBtn) {
        this.dom.markAllBtn.disabled = unreadCount === 0;
        this.dom.markAllBtn.style.opacity = unreadCount === 0 ? '0.45' : '1';
        this.dom.markAllBtn.style.cursor = unreadCount === 0 ? 'default' : 'pointer';
      }

      this.renderList();
    }

    renderList() {
      if (!this.dom.list) return;

      let items = this.notifications;
      if (this.currentFilter === 'unread') {
        items = items.filter((n) => !this.readIds.has(n.id));
      }

      if (items.length === 0) {
        this.dom.list.innerHTML = `
          <div class="notif-empty">
            <span class="notif-empty-icon">🌻</span>
            <p style="margin: 0; font-weight: 600; color: var(--ink);">Không có thông báo nào</p>
            <span style="font-size: 0.8rem; color: var(--ink-soft); display: block; margin-top: 4px;">
              ${this.currentFilter === 'unread' ? 'Bạn đã đọc hết tất cả thông báo!' : 'Bạn đã cập nhật mọi tin tức mới nhất.'}
            </span>
          </div>
        `;
        return;
      }

      const html = items.map((notif) => {
        const isUnread = !this.readIds.has(notif.id);
        const iconBg = notif.color || '#FEF3C7';
        return `
          <div class="notif-item ${isUnread ? 'unread' : 'read'}" data-id="${notif.id}">
            <div class="notif-item-icon" style="background:${iconBg};">
              <span>${notif.icon || '🔔'}</span>
            </div>
            <div class="notif-item-content">
              <div class="notif-item-title">
                <span>${this.escape(notif.title)}</span>
                ${isUnread ? '<span class="notif-dot" title="Chưa đọc"></span>' : ''}
              </div>
              <div class="notif-item-desc">${this.escape(notif.message)}</div>
              <span class="notif-item-time">${this.escape(notif.time || 'Vừa xong')}</span>
            </div>
          </div>
        `;
      }).join('');

      this.dom.list.innerHTML = html;

      // Add click handlers on notification items
      this.dom.list.querySelectorAll('.notif-item').forEach((elem) => {
        elem.addEventListener('click', () => {
          const id = elem.dataset.id;
          if (id) {
            this.markAsRead(id);
          }
        });
      });
    }

    showToast(message) {
      let container = document.getElementById('notifToastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'notifToastContainer';
        container.className = 'notif-toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = 'notif-toast';
      toast.innerHTML = `
        <span class="notif-toast-icon">🌻</span>
        <span class="notif-toast-text">${this.escape(message)}</span>
      `;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('show');
      }, 10);

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    escape(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  window.IWNotifications = new NotificationService();

  // Auto initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.IWNotifications.init());
  } else {
    window.IWNotifications.init();
  }
})(window);

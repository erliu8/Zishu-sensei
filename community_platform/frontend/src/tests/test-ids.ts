/**
 * 测试 ID 常量
 * 用于在测试中定位元素
 */

export const TEST_IDS = {
  // 认证相关
  AUTH: {
    LOGIN_FORM: 'auth-login-form',
    REGISTER_FORM: 'auth-register-form',
    EMAIL_INPUT: 'auth-email-input',
    PASSWORD_INPUT: 'auth-password-input',
    CONFIRM_PASSWORD_INPUT: 'auth-confirm-password-input',
    USERNAME_INPUT: 'auth-username-input',
    SUBMIT_BUTTON: 'auth-submit-button',
    ERROR_MESSAGE: 'auth-error-message',
    SUCCESS_MESSAGE: 'auth-success-message',
    LOGOUT_BUTTON: 'auth-logout-button',
  },

  // 用户相关
  USER: {
    PROFILE_CARD: 'user-profile-card',
    AVATAR: 'user-avatar',
    NAME: 'user-name',
    EMAIL: 'user-email',
    BIO: 'user-bio',
    EDIT_BUTTON: 'user-edit-button',
    FOLLOW_BUTTON: 'user-follow-button',
    FOLLOWERS_COUNT: 'user-followers-count',
    FOLLOWING_COUNT: 'user-following-count',
  },

  // 内容相关
  CONTENT: {
    CARD: 'content-card',
    TITLE: 'content-title',
    DESCRIPTION: 'content-description',
    AUTHOR: 'content-author',
    CREATED_AT: 'content-created-at',
    LIKES_COUNT: 'content-likes-count',
    COMMENTS_COUNT: 'content-comments-count',
    LIKE_BUTTON: 'content-like-button',
    SHARE_BUTTON: 'content-share-button',
    DELETE_BUTTON: 'content-delete-button',
    EDIT_BUTTON: 'content-edit-button',
  },

  // 评论相关
  COMMENT: {
    SECTION: 'comment-section',
    ITEM: 'comment-item',
    AUTHOR: 'comment-author',
    CONTENT: 'comment-content',
    CREATED_AT: 'comment-created-at',
    REPLY_BUTTON: 'comment-reply-button',
    DELETE_BUTTON: 'comment-delete-button',
    INPUT: 'comment-input',
    SUBMIT_BUTTON: 'comment-submit-button',
  },

  // 搜索相关
  SEARCH: {
    INPUT: 'search-input',
    BUTTON: 'search-button',
    RESULTS: 'search-results',
    RESULT_ITEM: 'search-result-item',
    NO_RESULTS: 'search-no-results',
    LOADING: 'search-loading',
  },

  // 导航相关
  NAV: {
    HEADER: 'nav-header',
    MENU: 'nav-menu',
    MENU_ITEM: 'nav-menu-item',
    LOGO: 'nav-logo',
    USER_MENU: 'nav-user-menu',
    NOTIFICATIONS: 'nav-notifications',
    SIDEBAR: 'nav-sidebar',
  },

  // 表单相关
  FORM: {
    CONTAINER: 'form-container',
    FIELD: 'form-field',
    LABEL: 'form-label',
    INPUT: 'form-input',
    ERROR: 'form-error',
    SUBMIT: 'form-submit',
    CANCEL: 'form-cancel',
    RESET: 'form-reset',
  },

  // UI 组件
  UI: {
    BUTTON: 'ui-button',
    DIALOG: 'ui-dialog',
    MODAL: 'ui-modal',
    TOAST: 'ui-toast',
    LOADING: 'ui-loading',
    ERROR: 'ui-error',
    CARD: 'ui-card',
    DROPDOWN: 'ui-dropdown',
  },

  // 学习相关
  LEARNING: {
    DASHBOARD: 'learning-dashboard',
    PROGRESS_BAR: 'learning-progress-bar',
    STREAK: 'learning-streak',
    POINTS: 'learning-points',
    LEVEL: 'learning-level',
    STUDY_SESSION: 'learning-study-session',
    FLASHCARD: 'learning-flashcard',
    QUIZ: 'learning-quiz',
  },

  // 市场相关
  MARKET: {
    GRID: 'market-grid',
    ITEM: 'market-item',
    FILTER: 'market-filter',
    SORT: 'market-sort',
    CATEGORY: 'market-category',
    PRICE: 'market-price',
    BUY_BUTTON: 'market-buy-button',
    CART: 'market-cart',
  },
} as const;

export type TestIds = typeof TEST_IDS;


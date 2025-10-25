/**
 * 屏幕阅读器测试辅助函数
 */

/**
 * ARIA 角色常量
 */
export const AriaRoles = {
  BUTTON: 'button',
  LINK: 'link',
  HEADING: 'heading',
  TEXTBOX: 'textbox',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  COMBOBOX: 'combobox',
  LISTBOX: 'listbox',
  OPTION: 'option',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  TAB: 'tab',
  TABPANEL: 'tabpanel',
  DIALOG: 'dialog',
  ALERTDIALOG: 'alertdialog',
  ALERT: 'alert',
  STATUS: 'status',
  PROGRESSBAR: 'progressbar',
  SLIDER: 'slider',
  NAVIGATION: 'navigation',
  MAIN: 'main',
  BANNER: 'banner',
  CONTENTINFO: 'contentinfo',
  COMPLEMENTARY: 'complementary',
  REGION: 'region',
  SEARCH: 'search',
  FORM: 'form',
  LIST: 'list',
  LISTITEM: 'listitem',
  TABLE: 'table',
  ROW: 'row',
  CELL: 'cell',
} as const;

/**
 * ARIA 实时区域（Live Region）类型
 */
export const AriaLive = {
  OFF: 'off',
  POLITE: 'polite',
  ASSERTIVE: 'assertive',
} as const;

/**
 * 获取元素的 ARIA 角色
 */
export function getAriaRole(element: HTMLElement): string | null {
  return element.getAttribute('role');
}

/**
 * 检查元素是否具有指定的 ARIA 角色
 */
export function hasAriaRole(element: HTMLElement, role: string): boolean {
  return getAriaRole(element) === role;
}

/**
 * 获取 ARIA 实时区域的内容
 */
export function getLiveRegionContent(container: HTMLElement): {
  polite: string[];
  assertive: string[];
} {
  const politeRegions = container.querySelectorAll('[aria-live="polite"]');
  const assertiveRegions = container.querySelectorAll('[aria-live="assertive"]');
  
  return {
    polite: Array.from(politeRegions).map(r => r.textContent?.trim() || ''),
    assertive: Array.from(assertiveRegions).map(r => r.textContent?.trim() || ''),
  };
}

/**
 * 检查元素的 ARIA 标签
 */
export function getAriaLabel(element: HTMLElement): string | null {
  return element.getAttribute('aria-label');
}

/**
 * 检查元素的 ARIA labelledby
 */
export function getAriaLabelledBy(element: HTMLElement): string | null {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (!labelledBy) return null;
  
  const labelElement = document.getElementById(labelledBy);
  return labelElement ? labelElement.textContent?.trim() || null : null;
}

/**
 * 检查元素的 ARIA describedby
 */
export function getAriaDescribedBy(element: HTMLElement): string | null {
  const describedBy = element.getAttribute('aria-describedby');
  if (!describedBy) return null;
  
  const descElement = document.getElementById(describedBy);
  return descElement ? descElement.textContent?.trim() || null : null;
}

/**
 * 获取完整的可访问描述
 */
export function getAccessibleDescription(element: HTMLElement): {
  name: string;
  description: string | null;
  role: string | null;
} {
  // 名称优先级：aria-labelledby > aria-label > label > content
  const labelledBy = getAriaLabelledBy(element);
  const ariaLabel = getAriaLabel(element);
  
  let name = labelledBy || ariaLabel;
  
  if (!name) {
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      name = label?.textContent?.trim() || '';
    }
  }
  
  if (!name) {
    name = element.textContent?.trim() || '';
  }
  
  return {
    name,
    description: getAriaDescribedBy(element),
    role: getAriaRole(element),
  };
}

/**
 * 检查元素的 ARIA 状态
 */
export function getAriaStates(element: HTMLElement): {
  expanded?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  pressed?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  invalid?: boolean;
  required?: boolean;
  readonly?: boolean;
  busy?: boolean;
} {
  const states: ReturnType<typeof getAriaStates> = {};
  
  const expanded = element.getAttribute('aria-expanded');
  if (expanded !== null) states.expanded = expanded === 'true';
  
  const selected = element.getAttribute('aria-selected');
  if (selected !== null) states.selected = selected === 'true';
  
  const checked = element.getAttribute('aria-checked');
  if (checked !== null) {
    states.checked = checked === 'mixed' ? 'mixed' : checked === 'true';
  }
  
  const pressed = element.getAttribute('aria-pressed');
  if (pressed !== null) states.pressed = pressed === 'true';
  
  const disabled = element.getAttribute('aria-disabled');
  if (disabled !== null) states.disabled = disabled === 'true';
  
  const hidden = element.getAttribute('aria-hidden');
  if (hidden !== null) states.hidden = hidden === 'true';
  
  const invalid = element.getAttribute('aria-invalid');
  if (invalid !== null) states.invalid = invalid === 'true';
  
  const required = element.getAttribute('aria-required');
  if (required !== null) states.required = required === 'true';
  
  const readonly = element.getAttribute('aria-readonly');
  if (readonly !== null) states.readonly = readonly === 'true';
  
  const busy = element.getAttribute('aria-busy');
  if (busy !== null) states.busy = busy === 'true';
  
  return states;
}

/**
 * 检查元素的 ARIA 属性
 */
export function getAriaProperties(element: HTMLElement): {
  controls?: string;
  describedby?: string;
  details?: string;
  flowto?: string;
  labelledby?: string;
  owns?: string;
  posinset?: number;
  setsize?: number;
  level?: number;
  valuemin?: number;
  valuemax?: number;
  valuenow?: number;
  valuetext?: string;
} {
  const props: ReturnType<typeof getAriaProperties> = {};
  
  const controls = element.getAttribute('aria-controls');
  if (controls) props.controls = controls;
  
  const describedby = element.getAttribute('aria-describedby');
  if (describedby) props.describedby = describedby;
  
  const details = element.getAttribute('aria-details');
  if (details) props.details = details;
  
  const flowto = element.getAttribute('aria-flowto');
  if (flowto) props.flowto = flowto;
  
  const labelledby = element.getAttribute('aria-labelledby');
  if (labelledby) props.labelledby = labelledby;
  
  const owns = element.getAttribute('aria-owns');
  if (owns) props.owns = owns;
  
  const posinset = element.getAttribute('aria-posinset');
  if (posinset) props.posinset = parseInt(posinset);
  
  const setsize = element.getAttribute('aria-setsize');
  if (setsize) props.setsize = parseInt(setsize);
  
  const level = element.getAttribute('aria-level');
  if (level) props.level = parseInt(level);
  
  const valuemin = element.getAttribute('aria-valuemin');
  if (valuemin) props.valuemin = parseFloat(valuemin);
  
  const valuemax = element.getAttribute('aria-valuemax');
  if (valuemax) props.valuemax = parseFloat(valuemax);
  
  const valuenow = element.getAttribute('aria-valuenow');
  if (valuenow) props.valuenow = parseFloat(valuenow);
  
  const valuetext = element.getAttribute('aria-valuetext');
  if (valuetext) props.valuetext = valuetext;
  
  return props;
}

/**
 * 模拟屏幕阅读器公告
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): HTMLElement {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // 在测试中，我们需要立即返回元素
  // 在实际应用中，可能需要延迟清理
  return announcement;
}

/**
 * 清理屏幕阅读器公告
 */
export function cleanupScreenReaderAnnouncements(): void {
  const announcements = document.querySelectorAll('[role="status"], [role="alert"]');
  announcements.forEach(el => el.remove());
}

/**
 * 检查元素是否对屏幕阅读器隐藏
 */
export function isHiddenFromScreenReader(element: HTMLElement): boolean {
  // 检查 aria-hidden
  if (element.getAttribute('aria-hidden') === 'true') {
    return true;
  }
  
  // 检查 display: none 或 visibility: hidden
  const styles = window.getComputedStyle(element);
  if (styles.display === 'none' || styles.visibility === 'hidden') {
    return true;
  }
  
  // 检查父元素
  const parent = element.parentElement;
  if (parent && parent !== document.body) {
    return isHiddenFromScreenReader(parent);
  }
  
  return false;
}

/**
 * 获取屏幕阅读器会读取的文本内容
 */
export function getScreenReaderText(element: HTMLElement): string {
  if (isHiddenFromScreenReader(element)) {
    return '';
  }
  
  const accessible = getAccessibleDescription(element);
  return accessible.name || element.textContent?.trim() || '';
}

/**
 * 检查表单错误消息的可访问性
 */
export function checkFormErrorAccessibility(
  input: HTMLElement,
  errorMessage: HTMLElement
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 检查 aria-invalid
  const ariaInvalid = input.getAttribute('aria-invalid');
  if (ariaInvalid !== 'true') {
    errors.push('Input should have aria-invalid="true"');
  }
  
  // 检查 aria-describedby 是否指向错误消息
  const describedBy = input.getAttribute('aria-describedby');
  const errorId = errorMessage.getAttribute('id');
  
  if (!describedBy || !errorId || !describedBy.includes(errorId)) {
    errors.push('Input should have aria-describedby pointing to error message');
  }
  
  // 检查错误消息是否有适当的角色
  const role = errorMessage.getAttribute('role');
  if (role !== 'alert' && !errorMessage.hasAttribute('aria-live')) {
    errors.push('Error message should have role="alert" or aria-live');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 检查加载状态的可访问性
 */
export function checkLoadingAccessibility(container: HTMLElement): {
  valid: boolean;
  hasLiveRegion: boolean;
  hasAriaLabel: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // 查找加载指示器
  const loadingElements = container.querySelectorAll('[aria-busy="true"], [role="progressbar"], [role="status"]');
  
  if (loadingElements.length === 0) {
    errors.push('Loading state should have aria-busy, progressbar, or status role');
  }
  
  let hasLiveRegion = false;
  let hasAriaLabel = false;
  
  loadingElements.forEach(element => {
    if (element.hasAttribute('aria-live') || element.getAttribute('role') === 'status') {
      hasLiveRegion = true;
    }
    
    if (element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby')) {
      hasAriaLabel = true;
    }
  });
  
  if (!hasAriaLabel) {
    errors.push('Loading indicator should have an accessible label');
  }
  
  return {
    valid: errors.length === 0,
    hasLiveRegion,
    hasAriaLabel,
    errors,
  };
}

/**
 * 检查对话框的可访问性
 */
export function checkDialogAccessibility(dialog: HTMLElement): {
  valid: boolean;
  hasRole: boolean;
  hasLabel: boolean;
  hasModal: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  const role = dialog.getAttribute('role');
  const hasRole = role === 'dialog' || role === 'alertdialog';
  
  if (!hasRole) {
    errors.push('Dialog should have role="dialog" or role="alertdialog"');
  }
  
  const hasLabel = !!(
    dialog.getAttribute('aria-label') ||
    dialog.getAttribute('aria-labelledby')
  );
  
  if (!hasLabel) {
    errors.push('Dialog should have aria-label or aria-labelledby');
  }
  
  const ariaModal = dialog.getAttribute('aria-modal');
  const hasModal = ariaModal === 'true';
  
  if (!hasModal) {
    errors.push('Dialog should have aria-modal="true"');
  }
  
  return {
    valid: errors.length === 0,
    hasRole,
    hasLabel,
    hasModal,
    errors,
  };
}

/**
 * 生成屏幕阅读器测试报告
 */
export function generateScreenReaderReport(container: HTMLElement): {
  liveRegions: { type: string; priority: string; content: string }[];
  hiddenElements: number;
  accessibleElements: { tag: string; role: string | null; name: string }[];
  issues: string[];
} {
  const liveRegions = Array.from(
    container.querySelectorAll<HTMLElement>('[aria-live], [role="status"], [role="alert"]')
  ).map(element => ({
    type: element.getAttribute('role') || 'live-region',
    priority: element.getAttribute('aria-live') || 'polite',
    content: element.textContent?.trim() || '',
  }));
  
  const allElements = Array.from(container.querySelectorAll<HTMLElement>('*'));
  const hiddenElements = allElements.filter(isHiddenFromScreenReader).length;
  
  const accessibleElements = allElements
    .filter(el => !isHiddenFromScreenReader(el))
    .map(el => {
      const description = getAccessibleDescription(el);
      return {
        tag: el.tagName.toLowerCase(),
        role: description.role,
        name: description.name,
      };
    })
    .filter(el => el.name); // 只包含有名称的元素
  
  const issues: string[] = [];
  
  // 检查是否有未标记的交互元素
  const interactiveElements = container.querySelectorAll<HTMLElement>(
    'button, a, input, select, textarea'
  );
  
  interactiveElements.forEach(el => {
    const description = getAccessibleDescription(el);
    if (!description.name) {
      issues.push(`Interactive element ${el.tagName.toLowerCase()} has no accessible name`);
    }
  });
  
  return {
    liveRegions,
    hiddenElements,
    accessibleElements,
    issues,
  };
}


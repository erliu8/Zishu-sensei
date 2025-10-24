/**
 * MSW Handlers 导出
 * @module tests/mocks/handlers
 */

import { authHandlers } from './auth';
import { userHandlers } from './user';
import { postHandlers } from './post';
import { commentHandlers } from './comment';
import { socialHandlers } from './social';
import { adapterHandlers } from './adapter';
import { characterHandlers } from './character';
import { packagingHandlers } from './packaging';

/**
 * 所有 MSW handlers 的集合
 */
export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...postHandlers,
  ...commentHandlers,
  ...socialHandlers,
  ...adapterHandlers,
  ...characterHandlers,
  ...packagingHandlers,
];

export {
  authHandlers,
  userHandlers,
  postHandlers,
  commentHandlers,
  socialHandlers,
  adapterHandlers,
  characterHandlers,
  packagingHandlers,
};

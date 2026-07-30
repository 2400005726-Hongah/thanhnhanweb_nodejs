import { Router } from 'express'

import { PERMISSIONS } from '../config/permissions.js'
import {
  changeNewsStatus,
  createNews,
  deleteNews,
  listNews,
  showNews,
  updateNews,
} from '../controllers/news.controller.js'
import {
  authenticate,
  authorizePermissions,
} from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  changeNewsStatusValidator,
  createNewsValidator,
  listNewsValidator,
  newsIdValidator,
  updateNewsValidator,
} from '../validators/news.validator.js'

const router = Router()

router.use(
  authenticate,
  authorizePermissions(PERMISSIONS.MANAGE_NEWS),
)
router.get('/', listNewsValidator, validate, listNews)
router.get('/:id', newsIdValidator, validate, showNews)
router.post('/', createNewsValidator, validate, createNews)
router.patch('/:id', updateNewsValidator, validate, updateNews)
router.patch(
  '/:id/status',
  changeNewsStatusValidator,
  validate,
  changeNewsStatus,
)
router.delete('/:id', newsIdValidator, validate, deleteNews)

export default router

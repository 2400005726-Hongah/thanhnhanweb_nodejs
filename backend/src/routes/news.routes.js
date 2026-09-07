import express, { Router } from 'express'

import { PERMISSIONS } from '../config/permissions.js'
import {
  changeNewsStatus,
  createNews,
  deleteNews,
  listNews,
  removeNewsImage,
  showNews,
  updateNews,
  uploadNewsImage,
} from '../controllers/news.controller.js'
import {
  authenticate,
  authorizePermissions,
} from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  changeNewsStatusValidator,
  createNewsValidator,
  deleteNewsImageValidator,
  listNewsValidator,
  newsIdValidator,
  updateNewsValidator,
} from '../validators/news.validator.js'

const router = Router()

router.use(
  authenticate,
  authorizePermissions(PERMISSIONS.MANAGE_NEWS),
)

// Đặt route ảnh trước /:id để Express không hiểu "images" là ID tin tức.
router.post(
  '/images',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: '5mb',
  }),
  uploadNewsImage,
)
router.delete('/images', deleteNewsImageValidator, validate, removeNewsImage)

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

import { Router } from 'express'

import {
  adminLogin,
  changePassword,
  login,
  me,
  register,
} from '../controllers/auth.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import validate from '../middlewares/validate.middleware.js'
import {
  changePasswordValidator,
  loginValidator,
  registerValidator,
} from '../validators/auth.validator.js'

const router = Router()

router.post('/register', registerValidator, validate, register)
router.post('/login', loginValidator, validate, login)
router.post('/admin/login', loginValidator, validate, adminLogin)
router.get('/me', authenticate, me)
router.patch(
  '/change-password',
  authenticate,
  changePasswordValidator,
  validate,
  changePassword,
)

export default router


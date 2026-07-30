import {
  changePassword as changePasswordService,
  getCurrentUser,
  login as loginService,
  register as registerService,
} from '../services/auth.service.js'

const register = async (request, response, next) => {
  try {
    const data = await registerService(request.body)

    response.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const login = async (request, response, next) => {
  try {
    const data = await loginService(request.body)

    response.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data,
    })
  } catch (error) {
    next(error)
  }
}

const me = (request, response) => {
  response.status(200).json({
    success: true,
    message: 'Lấy thông tin tài khoản thành công',
    data: {
      user: getCurrentUser(request.user),
    },
  })
}

const changePassword = async (request, response, next) => {
  try {
    await changePasswordService({
      userId: request.user.id,
      currentPassword: request.body.currentPassword,
      newPassword: request.body.newPassword,
    })

    response.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công',
      data: {},
    })
  } catch (error) {
    next(error)
  }
}

export { changePassword, login, me, register }

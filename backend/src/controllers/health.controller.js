export const getHealth = (_request, response) => {
  response.status(200).json({
    success: true,
    message: 'NHÀ XE THÀNH NHÂN API đang hoạt động',
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
    },
  })
}


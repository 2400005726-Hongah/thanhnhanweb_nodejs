import {
  addBusSeat as addBusSeatService,
  createBus as createBusService,
  deactivateBus,
  deactivateBusSeat,
  getBusById,
  getBuses,
  getBusSeats,
  updateBus as updateBusService,
  updateBusSeat as updateBusSeatService,
} from '../services/bus.service.js'

const listBuses = async (request, response, next) => {
  try {
    const data = await getBuses(request.query)
    response.status(200).json({ success: true, message: 'Lấy danh sách xe thành công', data })
  } catch (error) {
    next(error)
  }
}

const showBus = async (request, response, next) => {
  try {
    const bus = await getBusById(request.params.id)
    response.status(200).json({ success: true, message: 'Lấy thông tin xe thành công', data: { bus } })
  } catch (error) {
    next(error)
  }
}

const createBus = async (request, response, next) => {
  try {
    const bus = await createBusService(request.body)
    response.status(201).json({ success: true, message: 'Tạo xe thành công', data: { bus } })
  } catch (error) {
    next(error)
  }
}

const updateBus = async (request, response, next) => {
  try {
    const bus = await updateBusService(request.params.id, request.body)
    response.status(200).json({ success: true, message: 'Cập nhật xe thành công', data: { bus } })
  } catch (error) {
    next(error)
  }
}

const deleteBus = async (request, response, next) => {
  try {
    const bus = await deactivateBus(request.params.id)
    response.status(200).json({ success: true, message: 'Ngừng hoạt động xe thành công', data: { bus } })
  } catch (error) {
    next(error)
  }
}

const listBusSeats = async (request, response, next) => {
  try {
    const data = await getBusSeats(request.params.busId)
    response.status(200).json({ success: true, message: 'Lấy danh sách ghế thành công', data })
  } catch (error) {
    next(error)
  }
}

const addBusSeat = async (request, response, next) => {
  try {
    const seat = await addBusSeatService(request.params.busId, request.body)
    response.status(201).json({ success: true, message: 'Thêm ghế thành công', data: { seat } })
  } catch (error) {
    next(error)
  }
}

const updateBusSeat = async (request, response, next) => {
  try {
    const seat = await updateBusSeatService(request.params.busId, request.params.seatId, request.body)
    response.status(200).json({ success: true, message: 'Cập nhật ghế thành công', data: { seat } })
  } catch (error) {
    next(error)
  }
}

const deleteBusSeat = async (request, response, next) => {
  try {
    const seat = await deactivateBusSeat(request.params.busId, request.params.seatId)
    response.status(200).json({ success: true, message: 'Khóa ghế thành công', data: { seat } })
  } catch (error) {
    next(error)
  }
}

export {
  addBusSeat,
  createBus,
  deleteBus,
  deleteBusSeat,
  listBuses,
  listBusSeats,
  showBus,
  updateBus,
  updateBusSeat,
}


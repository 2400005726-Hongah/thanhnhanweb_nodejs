import { randomUUID } from 'node:crypto'

import {
  resolveBookingServiceSelection,
} from '../src/services/bookingServicePoint.service.js'

const departureLocation = {
  id: randomUUID(),
  name: 'Nhà xe Krông Năng',
  province: 'Đắk Lắk',
  address: 'Thị trấn Krông Năng',
}

const arrivalLocation = {
  id: randomUUID(),
  name: 'Bến xe An Sương',
  province: 'TP.HCM',
  address: 'Quận 12',
}

const meetingLocation = {
  id: randomUUID(),
  name: 'Buôn Hồ',
  province: 'Đắk Lắk',
  address: 'Văn phòng Buôn Hồ',
}

const stopLocation = {
  id: randomUUID(),
  name: 'Tân Bình',
  province: 'TP.HCM',
  address: 'Điểm dừng Tân Bình',
}

const pickupPrimaryId = randomUUID()
const dropoffPrimaryId = randomUUID()
const meetingPointId = randomUUID()
const stopPointId = randomUUID()

const trip = {
  id: randomUUID(),
  primaryPickupMode: 'DonTaiBenXe',
  primaryDropoffMode: 'TraTaiBenXe',
  allowPickupTransfer: true,
  allowPickupMeetingPoint: true,
  allowDropoffTransfer: true,
  allowDropoffStop: true,
  departureLocation,
  arrivalLocation,
  route: {
    departureLocation,
    arrivalLocation,
  },
  servicePoints: [
    {
      id: pickupPrimaryId,
      pointType: 'PICKUP',
      serviceMode: 'DonTaiBenXe',
      isDefault: true,
      status: 'ACTIVE',
      location: departureLocation,
    },
    {
      id: meetingPointId,
      pointType: 'PICKUP',
      serviceMode: 'DonTaiDiemHen',
      isDefault: false,
      status: 'ACTIVE',
      location: meetingLocation,
    },
    {
      id: dropoffPrimaryId,
      pointType: 'DROPOFF',
      serviceMode: 'TraTaiBenXe',
      isDefault: true,
      status: 'ACTIVE',
      location: arrivalLocation,
    },
    {
      id: stopPointId,
      pointType: 'DROPOFF',
      serviceMode: 'TraTaiDiemDung',
      isDefault: false,
      status: 'ACTIVE',
      location: stopLocation,
    },
  ],
}

describe('Giai đoạn 6 - lựa chọn điểm đón/trả khi đặt vé', () => {
  test('mặc định dùng điểm đón và điểm trả chính của chuyến', () => {
    const result = resolveBookingServiceSelection(trip, {})

    expect(result.pickup).toMatchObject({
      kind: 'DiemChinh',
      locationId: departureLocation.id,
      servicePointId: pickupPrimaryId,
      serviceMode: 'DonTaiBenXe',
    })
    expect(result.dropoff).toMatchObject({
      kind: 'DiemChinh',
      locationId: arrivalLocation.id,
      servicePointId: dropoffPrimaryId,
      serviceMode: 'TraTaiBenXe',
    })
  })

  test('chọn được điểm hẹn đón đã cấu hình cho chuyến', () => {
    const result = resolveBookingServiceSelection(trip, {
      pickupKind: 'DiemHen',
      pickupServicePointId: meetingPointId,
    })

    expect(result.pickup).toMatchObject({
      kind: 'DiemHen',
      locationId: meetingLocation.id,
      servicePointId: meetingPointId,
      serviceMode: 'DonTaiDiemHen',
    })
  })

  test('chọn được điểm dừng trả đã cấu hình cho chuyến', () => {
    const result = resolveBookingServiceSelection(trip, {
      dropoffKind: 'DiemDung',
      dropoffServicePointId: stopPointId,
    })

    expect(result.dropoff).toMatchObject({
      kind: 'DiemDung',
      locationId: stopLocation.id,
      servicePointId: stopPointId,
      serviceMode: 'TraTaiDiemDung',
    })
  })

  test('trung chuyển đón bắt buộc địa chỉ cụ thể', () => {
    expect(() =>
      resolveBookingServiceSelection(trip, {
        pickupKind: 'TrungChuyen',
        pickupRequestedAddress: 'A',
      }),
    ).toThrow('Vui lòng nhập địa chỉ đón cụ thể')
  })

  test('trung chuyển trả lưu snapshot địa chỉ khách yêu cầu', () => {
    const result = resolveBookingServiceSelection(trip, {
      dropoffKind: 'TrungChuyen',
      dropoffRequestedAddress: '123 Nguyễn Văn Trỗi, Phú Nhuận',
    })

    expect(result.dropoff).toMatchObject({
      kind: 'TrungChuyen',
      locationId: null,
      servicePointId: null,
      serviceMode: 'TrungChuyenTraKhach',
      requestedAddress: '123 Nguyễn Văn Trỗi, Phú Nhuận',
      pointText: '123 Nguyễn Văn Trỗi, Phú Nhuận',
    })
  })

  test('không cho chọn điểm hẹn nếu chuyến đã tắt chức năng này', () => {
    expect(() =>
      resolveBookingServiceSelection(
        { ...trip, allowPickupMeetingPoint: false },
        {
          pickupKind: 'DiemHen',
          pickupServicePointId: meetingPointId,
        },
      ),
    ).toThrow('không hỗ trợ đón khách tại điểm hẹn')
  })

  test('không cho dùng điểm phục vụ sai loại', () => {
    expect(() =>
      resolveBookingServiceSelection(trip, {
        pickupKind: 'DiemHen',
        pickupServicePointId: stopPointId,
      }),
    ).toThrow('Điểm hẹn đón khách không hợp lệ')
  })
})

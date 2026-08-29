import { jest } from '@jest/globals'

const prisma = {}
jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }))

const { validateStops } = await import('../src/services/routeStop.service.js')

const DAK_LAK = '11111111-1111-4111-8111-111111111111'
const HCM = '22222222-2222-4222-8222-222222222222'
const AREA_DAK_LAK = '33333333-3333-4333-8333-333333333333'
const AREA_HCM = '44444444-4444-4444-8444-444444444444'

const route = {
  departureLocation: { provinceId: DAK_LAK },
  arrivalLocation: { provinceId: HCM },
}

const database = {
  pickupDropoffArea: {
    findMany: async ({ where }) => {
      const all = [
        { id: AREA_DAK_LAK, provinceId: DAK_LAK, status: 'ACTIVE' },
        { id: AREA_HCM, provinceId: HCM, status: 'ACTIVE' },
      ]
      return all.filter((area) => where.id.in.includes(area.id))
    },
  },
}

describe('routeStop.service', () => {
  test('chấp nhận khu vực đón thuộc điểm đi và khu vực trả thuộc điểm đến', async () => {
    await expect(
      validateStops(database, route, [
        { areaId: AREA_DAK_LAK, pointType: 'PICKUP', sortOrder: 1 },
        { areaId: AREA_HCM, pointType: 'DROPOFF', sortOrder: 1 },
      ]),
    ).resolves.toEqual([
      {
        areaId: AREA_DAK_LAK,
        pointType: 'PICKUP',
        sortOrder: 1,
        status: 'ACTIVE',
      },
      {
        areaId: AREA_HCM,
        pointType: 'DROPOFF',
        sortOrder: 1,
        status: 'ACTIVE',
      },
    ])
  })

  test('chặn khu vực đón thuộc sai tỉnh/thành', async () => {
    await expect(
      validateStops(database, route, [
        { areaId: AREA_HCM, pointType: 'PICKUP' },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  test('chặn một khu vực lặp lại cùng loại trên tuyến', async () => {
    await expect(
      validateStops(database, route, [
        { areaId: AREA_DAK_LAK, pointType: 'PICKUP' },
        { areaId: AREA_DAK_LAK, pointType: 'PICKUP' },
      ]),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

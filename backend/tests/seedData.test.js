import { jest } from '@jest/globals'

jest.unstable_mockModule('../src/config/database.js', () => ({
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}))
jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: {} }))

const {
  DEFAULT_SCHEDULE_DAYS,
  buildScheduleTemplates,
  busData,
  locationData,
  recurringServices,
  routeData,
} = await import('../src/jobs/seedData.js')

describe('expanded demo schedule seed', () => {
  test('contains the expanded master data', () => {
    expect(locationData).toHaveLength(6)
    expect(routeData).toHaveLength(10)
    expect(busData).toHaveLength(10)
    expect(busData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          busType: 'SLEEPER',
          capacity: 44,
        }),
        expect.objectContaining({
          busType: 'SLEEPER_34',
          capacity: 34,
        }),
        expect.objectContaining({
          busType: 'LIMOUSINE_22',
          capacity: 22,
        }),
      ]),
    )
  })

  test('builds two daily departures for every recurring service over 30 days', () => {
    const schedules = buildScheduleTemplates()

    expect(schedules).toHaveLength(
      DEFAULT_SCHEDULE_DAYS * recurringServices.length * 2,
    )
    expect(new Set(schedules.map((schedule) => schedule.dayOffset)).size).toBe(
      DEFAULT_SCHEDULE_DAYS,
    )
    expect(
      schedules.filter((schedule) => schedule.routeKey === 'BUON_HO_HCM'),
    ).toHaveLength(DEFAULT_SCHEDULE_DAYS * 2)
  })

  test('does not assign overlapping schedules to the same bus', () => {
    const schedulesByBus = buildScheduleTemplates().reduce(
      (groupedSchedules, schedule) => {
        const busSchedules = groupedSchedules.get(schedule.busPlate) || []
        busSchedules.push(schedule)
        groupedSchedules.set(schedule.busPlate, busSchedules)
        return groupedSchedules
      },
      new Map(),
    )

    for (const schedules of schedulesByBus.values()) {
      schedules.sort((left, right) => left.departureTime - right.departureTime)
      for (let index = 1; index < schedules.length; index += 1) {
        expect(schedules[index - 1].expectedArrivalTime.getTime()).toBeLessThanOrEqual(
          schedules[index].departureTime.getTime(),
        )
      }
    }
  })
})

import prisma from '../config/prisma.js'
import {
  getBusCapacity,
  getBusSeatTemplate,
  isManagedBusType,
} from '../config/busCatalog.js'
import HttpError from '../utils/HttpError.js'
import {
  buildPagination,
  parsePagination,
} from '../utils/query.js'
import {
  writeAuditLog,
} from './auditLog.service.js'
import {
  summarizeTripSeats,
} from './seatAvailability.service.js'
import {
  getTripSeatPrice,
  resolveTripPricing,
  serializeTripPricing,
} from './tripPricing.service.js'

const editableStatuses = [
  'OPEN',
  'CLOSED',
]

const statusTransitions = {
  OPEN: [
    'CLOSED',
    'DEPARTED',
    'CANCELLED',
  ],

  CLOSED: [
    'OPEN',
    'DEPARTED',
    'CANCELLED',
  ],

  DEPARTED: [
    'COMPLETED',
  ],

  COMPLETED: [],
  CANCELLED: [],
}

const tripStatusLabels = {
  OPEN: 'Đang mở bán',
  CLOSED: 'Đã đóng đặt vé',
  DEPARTED: 'Đã khởi hành',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
}

const getTripStatusLabel = (
  status,
) =>
  tripStatusLabels[status] ||
  'Không xác định'

const tripInclude = {
  route: {
    include: {
      departureLocation: true,
      arrivalLocation: true,
    },
  },

  bus: {
    select: {
      id: true,
      busName: true,
      licensePlate: true,
      busType: true,
      capacity: true,
      status: true,
    },
  },

  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  },
}

const ensureTripReferences = async (
  database,
  routeId,
  busId,
) => {
  const [
    route,
    bus,
  ] = await Promise.all([
    database.route.findFirst({
      where: {
        id: routeId,
        status: 'ACTIVE',
      },
    }),

    database.bus.findFirst({
      where: {
        id: busId,
        status: 'ACTIVE',
      },

      include: {
        seats: {
          where: {
            status: 'ACTIVE',
          },

          orderBy: {
            seatCode: 'asc',
          },
        },
      },
    }),
  ])

  if (!route) {
    throw new HttpError(
      'Tuyến xe không tồn tại hoặc không hoạt động',
      400,
    )
  }

  if (!bus) {
    throw new HttpError(
      'Xe không tồn tại hoặc không hoạt động',
      400,
    )
  }

  if (
    bus.seats.length === 0
  ) {
    throw new HttpError(
      'Xe phải có ít nhất một ghế đang hoạt động',
      400,
    )
  }

  if (
    isManagedBusType(
      bus.busType,
    )
  ) {
    const expectedCapacity =
      getBusCapacity(
        bus.busType,
      )

    const expectedSeats =
      getBusSeatTemplate(
        bus.busType,
      )

    const actualByCode =
      new Map(
        bus.seats.map(
          (seat) => [
            seat.seatCode,
            seat,
          ],
        ),
      )

    const structureMatches =
      bus.capacity ===
        expectedCapacity &&
      bus.seats.length ===
        expectedSeats.length &&
      expectedSeats.every(
        (expected) => {
          const actual =
            actualByCode.get(
              expected.seatCode,
            )

          return (
            actual?.floor ===
              expected.floor &&
            actual?.seatType ===
              expected.seatType
          )
        },
      )

    if (!structureMatches) {
      throw new HttpError(
        'Sơ đồ ghế của xe không khớp mẫu chuẩn; không thể tạo chuyến',
        409,
      )
    }
  }

  return {
    route,
    bus,
    activeSeats: bus.seats,
  }
}

const ensureNoScheduleConflict =
  async (
    database,
    {
      busId,
      departureTime,
      expectedArrivalTime,
      excludeTripId,
    },
  ) => {
    const conflict =
      await database.trip.findFirst({
        where: {
          busId,

          status: {
            not: 'CANCELLED',
          },

          departureTime: {
            lt: expectedArrivalTime,
          },

          expectedArrivalTime: {
            gt: departureTime,
          },

          ...(excludeTripId && {
            id: {
              not: excludeTripId,
            },
          }),
        },

        select: {
          id: true,
        },
      })

    if (conflict) {
      throw new HttpError(
        'Xe đã có chuyến bị trùng thời gian',
        409,
      )
    }
  }

const buildTripSeatData = (
  tripId,
  seats,
  pricing,
) =>
  seats.map((seat) => ({
    tripId,
    seatId: seat.id,
    seatCode: seat.seatCode,
    floor: seat.floor,
    seatType: seat.seatType,

    price:
      getTripSeatPrice(
        pricing,
        seat.seatType,
      ),

    status: 'AVAILABLE',
  }))

const serializeManagedTrip = (
  trip,
  now = new Date(),
) => {
  const pricing =
    serializeTripPricing(
      resolveTripPricing({
        busType:
          trip.bus.busType,

        route:
          trip.route,

        ticketPrice:
          trip.ticketPrice,

        singleRoomPrice:
          trip.singleRoomPrice,

        doubleRoomPrice:
          trip.doubleRoomPrice,
      }),
    )

  const {
    tripSeats,
    ...tripData
  } = trip

  return {
    ...tripData,
    ...pricing,

    ...(tripSeats && {
      seatStats:
        summarizeTripSeats(
          tripSeats,
          now,
        ),
    }),
  }
}

const getTrips = async ({
  query,
  isAdmin,
}) => {
  const {
    page,
    limit,
    skip,
  } = parsePagination(query)

  const now = new Date()

  const where = {
    ...(!isAdmin && {
      status: 'OPEN',

      departureTime: {
        gt: now,
      },
    }),

    ...(isAdmin &&
      query.status && {
        status:
          query.status,
      }),

    ...(query.route && {
      routeId:
        query.route,
    }),

    ...(isAdmin &&
      query.bus && {
        busId:
          query.bus,
      }),
  }

  if (
    query.departureDate
  ) {
    const start =
      new Date(
        `${query.departureDate}T00:00:00.000+07:00`,
      )

    const end =
      new Date(
        `${query.departureDate}T00:00:00.000+07:00`,
      )

    end.setUTCDate(
      end.getUTCDate() + 1,
    )

    where.departureTime = {
      gte:
        !isAdmin &&
        start < now
          ? now
          : start,

      lt: end,
    }
  }

  const [
    trips,
    total,
  ] = await Promise.all([
    prisma.trip.findMany({
      where,

      include: {
        ...tripInclude,

        ...(isAdmin && {
          tripSeats: {
            select: {
              status: true,
              holdExpiresAt: true,
            },
          },
        }),
      },

      orderBy: {
        departureTime:
          query.sort === 'desc'
            ? 'desc'
            : 'asc',
      },

      skip,
      take: limit,
    }),

    prisma.trip.count({
      where,
    }),
  ])

  return {
    trips:
      trips.map((trip) =>
        serializeManagedTrip(
          trip,
          now,
        ),
      ),

    pagination:
      buildPagination(
        total,
        page,
        limit,
      ),
  }
}

const getTripById = async ({
  tripId,
  isAdmin,
}) => {
  const trip =
    await prisma.trip.findFirst({
      where: {
        id: tripId,

        ...(!isAdmin && {
          status: 'OPEN',

          departureTime: {
            gt: new Date(),
          },
        }),
      },

      include: {
        ...tripInclude,

        ...(isAdmin && {
          tripSeats: {
            select: {
              status: true,
              holdExpiresAt: true,
            },
          },
        }),
      },
    })

  if (!trip) {
    throw new HttpError(
      'Không tìm thấy chuyến xe',
      404,
    )
  }

  return serializeManagedTrip(
    trip,
  )
}

const createTrip = async (
  payload,
  createdById,
  actor = null,
) => {
  const departureTime =
    new Date(
      payload.departureTime,
    )

  const expectedArrivalTime =
    new Date(
      payload.expectedArrivalTime,
    )

  if (
    departureTime <=
    new Date()
  ) {
    throw new HttpError(
      'Thời gian khởi hành phải ở tương lai',
      400,
    )
  }

  if (
    expectedArrivalTime <=
    departureTime
  ) {
    throw new HttpError(
      'Thời gian đến phải sau thời gian khởi hành',
      400,
    )
  }

  return prisma.$transaction(
    async (transaction) => {
      const {
        route,
        bus,
        activeSeats,
      } =
        await ensureTripReferences(
          transaction,
          payload.route,
          payload.bus,
        )

      await ensureNoScheduleConflict(
        transaction,
        {
          busId:
            payload.bus,

          departureTime,

          expectedArrivalTime,
        },
      )

      const pricing =
        resolveTripPricing({
          busType:
            bus.busType,

          route,

          ticketPrice:
            payload.ticketPrice,

          singleRoomPrice:
            payload.singleRoomPrice,

          doubleRoomPrice:
            payload.doubleRoomPrice,
        })

      const trip =
        await transaction.trip.create({
          data: {
            routeId:
              payload.route,

            busId:
              payload.bus,

            departureTime,

            expectedArrivalTime,

            ticketPrice:
              payload.ticketPrice ??
              null,

            singleRoomPrice:
              payload.singleRoomPrice ??
              null,

            doubleRoomPrice:
              payload.doubleRoomPrice ??
              null,

            status:
              payload.status ||
              'OPEN',

            createdById,
          },
        })

      await transaction.tripSeat.createMany({
        data:
          buildTripSeatData(
            trip.id,
            activeSeats,
            pricing,
          ),
      })

      const createdTrip =
        await transaction.trip.findUnique({
          where: {
            id: trip.id,
          },

          include:
            tripInclude,
        })

      if (actor) {
        await writeAuditLog(
          {
            userId:
              actor.id,

            role:
              actor.role,

            action:
              'CREATE_TRIP',

            entityType:
              'TRIP',

            entityId:
              trip.id,

            description:
              'Tạo chuyến xe mới',
          },

          transaction,
        )
      }

      return createdTrip
    },
  )
}

const updateTrip = async (
  tripId,
  payload,
  actor = null,
) =>
  prisma.$transaction(
    async (transaction) => {
      const trip =
        await transaction.trip.findUnique({
          where: {
            id: tripId,
          },
        })

      if (!trip) {
        throw new HttpError(
          'Không tìm thấy chuyến xe',
          404,
        )
      }

      if (
        trip.departureTime <= new Date()
      ) {
        throw new HttpError(
          'Chuyến đã qua giờ khởi hành nên không thể sửa thông tin',
          409,
        )
      }

      if (
        !editableStatuses.includes(
          trip.status,
        )
      ) {
        throw new HttpError(
          'Không thể sửa chuyến ở trạng thái hiện tại',
          409,
        )
      }

      const nextRouteId =
        payload.route ||
        trip.routeId

      const nextBusId =
        payload.bus ||
        trip.busId

      const nextDepartureTime =
        payload.departureTime
          ? new Date(
              payload.departureTime,
            )
          : trip.departureTime

      const nextArrivalTime =
        payload.expectedArrivalTime
          ? new Date(
              payload.expectedArrivalTime,
            )
          : trip.expectedArrivalTime

      const protectedChange =
        Boolean(
          payload.route ||
            payload.bus ||
            payload.departureTime ||
            payload.expectedArrivalTime,
        )

      if (protectedChange) {
        const [
          protectedSeatCount,
          bookingItemCount,
        ] = await Promise.all([
          transaction.tripSeat.count({
            where: {
              tripId,

              status: {
                in: [
                  'HELD',
                  'BOOKED',
                ],
              },
            },
          }),

          transaction.bookingItem.count({
            where: {
              tripSeat: {
                tripId,
              },
            },
          }),
        ])

        if (
          protectedSeatCount > 0 ||
          bookingItemCount > 0
        ) {
          throw new HttpError(
            'Không thể đổi tuyến, xe hoặc thời gian khi có ghế đang giữ hoặc lịch sử đặt vé',
            409,
          )
        }
      }

      if (
        nextDepartureTime <=
          new Date() ||
        nextArrivalTime <=
          nextDepartureTime
      ) {
        throw new HttpError(
          'Thời gian chuyến xe không hợp lệ',
          400,
        )
      }

      const {
        route,
        bus,
        activeSeats,
      } =
        await ensureTripReferences(
          transaction,
          nextRouteId,
          nextBusId,
        )

      await ensureNoScheduleConflict(
        transaction,
        {
          busId:
            nextBusId,

          departureTime:
            nextDepartureTime,

          expectedArrivalTime:
            nextArrivalTime,

          excludeTripId:
            tripId,
        },
      )

      const busChanged =
        nextBusId !==
        trip.busId

      const nextTicketPrice =
        payload.ticketPrice !==
        undefined
          ? payload.ticketPrice
          : trip.ticketPrice

      const nextSingleRoomPrice =
        payload.singleRoomPrice !==
        undefined
          ? payload.singleRoomPrice
          : trip.singleRoomPrice

      const nextDoubleRoomPrice =
        payload.doubleRoomPrice !==
        undefined
          ? payload.doubleRoomPrice
          : trip.doubleRoomPrice

      const pricing =
        resolveTripPricing({
          busType:
            bus.busType,

          route,

          ticketPrice:
            nextTicketPrice,

          singleRoomPrice:
            nextSingleRoomPrice,

          doubleRoomPrice:
            nextDoubleRoomPrice,
        })

      const pricingChanged =
        payload.ticketPrice !==
          undefined ||
        payload.singleRoomPrice !==
          undefined ||
        payload.doubleRoomPrice !==
          undefined ||
        payload.route !==
          undefined ||
        payload.bus !==
          undefined

      if (busChanged) {
        await transaction.tripSeat.deleteMany({
          where: {
            tripId,
          },
        })

        await transaction.tripSeat.createMany({
          data:
            buildTripSeatData(
              tripId,
              activeSeats,
              pricing,
            ),
        })
      } else if (
        pricingChanged
      ) {
        await Promise.all([
          transaction.tripSeat.updateMany({
            where: {
              tripId,
              status: 'AVAILABLE',

              seatType: {
                in: [
                  'NORMAL',
                  'VIP',
                ],
              },
            },

            data: {
              price:
                pricing.ticketPrice,
            },
          }),

          transaction.tripSeat.updateMany({
            where: {
              tripId,
              status: 'AVAILABLE',
              seatType: 'SINGLE_ROOM',
            },

            data: {
              price:
                pricing.singleRoomPrice ??
                pricing.ticketPrice,
            },
          }),

          transaction.tripSeat.updateMany({
            where: {
              tripId,
              status: 'AVAILABLE',
              seatType: 'DOUBLE_ROOM',
            },

            data: {
              price:
                pricing.doubleRoomPrice ??
                pricing.ticketPrice,
            },
          }),
        ])
      }

      const updatedTrip =
        await transaction.trip.update({
          where: {
            id: tripId,
          },

          data: {
            routeId:
              nextRouteId,

            busId:
              nextBusId,

            departureTime:
              nextDepartureTime,

            expectedArrivalTime:
              nextArrivalTime,

            ticketPrice:
              nextTicketPrice,

            singleRoomPrice:
              nextSingleRoomPrice,

            doubleRoomPrice:
              nextDoubleRoomPrice,
          },

          include:
            tripInclude,
        })

      if (actor) {
        await writeAuditLog(
          {
            userId:
              actor.id,

            role:
              actor.role,

            action:
              'UPDATE_TRIP',

            entityType:
              'TRIP',

            entityId:
              tripId,

            description:
              'Cập nhật thông tin chuyến xe',
          },

          transaction,
        )
      }

      return updatedTrip
    },
  )

const inspectTripCompletion = async (
  database,
  tripId,
) => {
  const bookings =
    await database.booking.findMany({
      where: {
        tripId,
        status: 'CONFIRMED',
      },

      select: {
        id: true,
        bookingCode: true,
        totalAmount: true,
        paymentStatus: true,

        payments: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },

          orderBy: {
            createdAt: 'desc',
          },

          take: 1,
        },
      },

      orderBy: {
        createdAt: 'asc',
      },
    })

  const paidBookings = []
  const unpaidBookings = []
  const missingPaymentBookings = []
  const abnormalPaymentBookings = []

  for (const booking of bookings) {
    const payment = booking.payments[0] || null

    if (!payment) {
      missingPaymentBookings.push(booking)
      continue
    }

    if (payment.status === 'SUCCESS') {
      paidBookings.push({
        ...booking,
        payment,
      })
      continue
    }

    if (payment.status === 'PENDING') {
      unpaidBookings.push({
        ...booking,
        payment,
      })
      continue
    }

    abnormalPaymentBookings.push({
      ...booking,
      payment,
    })
  }

  const unpaidAmount =
    unpaidBookings.reduce(
      (sum, booking) =>
        sum + Number(booking.totalAmount || 0),
      0,
    )

  return {
    validBookingCount:
      bookings.length,

    paidBookingCount:
      paidBookings.length,

    unpaidBookingCount:
      unpaidBookings.length,

    unpaidAmount,
    paidBookings,
    unpaidBookings,
    missingPaymentBookings,
    abnormalPaymentBookings,
  }
}

const getTripCompletionPreview = async (
  tripId,
) => {
  const trip =
    await prisma.trip.findUnique({
      where: {
        id: tripId,
      },

      select: {
        id: true,
        status: true,
        departureTime: true,
      },
    })

  if (!trip) {
    throw new HttpError(
      'Không tìm thấy chuyến xe',
      404,
    )
  }

  const now = new Date()

  if (
    trip.status === 'CANCELLED'
  ) {
    throw new HttpError(
      'Chuyến đã hủy nên không thể hoàn thành',
      409,
    )
  }

  if (
    trip.status === 'COMPLETED'
  ) {
    throw new HttpError(
      'Chuyến này đã được xác nhận hoàn thành',
      409,
    )
  }

  if (
    trip.departureTime > now
  ) {
    throw new HttpError(
      'Chuyến chưa qua giờ khởi hành nên chưa thể hoàn thành',
      409,
    )
  }

  const inspection =
    await inspectTripCompletion(
      prisma,
      tripId,
    )

  return {
    tripId,
    departureTime:
      trip.departureTime,

    validBookingCount:
      inspection.validBookingCount,

    paidBookingCount:
      inspection.paidBookingCount,

    unpaidBookingCount:
      inspection.unpaidBookingCount,

    unpaidAmount:
      inspection.unpaidAmount,

    missingPaymentCount:
      inspection.missingPaymentBookings.length,

    abnormalPaymentCount:
      inspection.abnormalPaymentBookings.length,

    canComplete:
      inspection.missingPaymentBookings.length === 0 &&
      inspection.abnormalPaymentBookings.length === 0,
  }
}

const changeTripStatus = async (
  tripId,
  nextStatus,
  actor = null,
  options = {},
) =>
  prisma.$transaction(
    async (transaction) => {
      const now =
        new Date()

      const trip =
        await transaction.trip.findUnique({
          where: {
            id: tripId,
          },

          select: {
            id: true,
            status: true,
            departureTime: true,
          },
        })

      if (!trip) {
        throw new HttpError(
          'Không tìm thấy chuyến xe',
          404,
        )
      }

      const hasDeparted =
        trip.departureTime <= now

      const completingAfterDeparture =
        nextStatus === 'COMPLETED' &&
        hasDeparted &&
        ['OPEN', 'CLOSED', 'DEPARTED'].includes(
          trip.status,
        )

      const allowedTransitions =
        statusTransitions[
          trip.status
        ] || []

      if (
        !completingAfterDeparture &&
        !allowedTransitions.includes(
          nextStatus,
        )
      ) {
        throw new HttpError(
          `Không thể chuyển chuyến từ trạng thái "${getTripStatusLabel(
            trip.status,
          )}" sang "${getTripStatusLabel(
            nextStatus,
          )}"`,
          400,
        )
      }

      if (
        hasDeparted &&
        ['OPEN', 'CLOSED', 'CANCELLED'].includes(
          nextStatus,
        )
      ) {
        throw new HttpError(
          'Chuyến đã qua giờ khởi hành nên không thể mở/đóng đặt vé hoặc hủy chuyến',
          409,
        )
      }

      if (
        nextStatus === 'DEPARTED' &&
        !hasDeparted
      ) {
        throw new HttpError(
          'Chưa đến giờ khởi hành của chuyến xe',
          400,
        )
      }

      if (
        nextStatus === 'COMPLETED' &&
        !hasDeparted
      ) {
        throw new HttpError(
          'Chuyến chưa qua giờ khởi hành nên chưa thể hoàn thành',
          409,
        )
      }

      if (
        nextStatus ===
        'CANCELLED'
      ) {
        const [
          bookedSeatCount,
          activeBookingCount,
        ] = await Promise.all([
          transaction.tripSeat.count({
            where: {
              tripId,
              status: 'BOOKED',
            },
          }),

          transaction.booking.count({
            where: {
              tripId,

              status: {
                in: [
                  'PENDING',
                  'CONFIRMED',
                ],
              },
            },
          }),
        ])

        if (
          bookedSeatCount > 0 ||
          activeBookingCount > 0
        ) {
          throw new HttpError(
            'Chưa thể hủy chuyến vì vẫn còn vé hoặc ghế đã đặt. Hãy xử lý hủy vé và hoàn tiền trước.',
            409,
          )
        }
      }

      let completedBookingCount = 0
      let noShowBookingCount = 0
      let pendingBookingCount = 0
      let collectedBookingCount = 0
      let collectedAmount = 0

      if (
        nextStatus ===
        'COMPLETED'
      ) {
        const inspection =
          await inspectTripCompletion(
            transaction,
            tripId,
          )

        if (
          inspection.missingPaymentBookings.length > 0
        ) {
          throw new HttpError(
            `Có ${inspection.missingPaymentBookings.length} vé thiếu dữ liệu thanh toán. Hãy kiểm tra từng vé trước khi hoàn thành chuyến.`,
            409,
            [
              {
                field: 'payments',
                code: 'MISSING_PAYMENT_DATA',
                count:
                  inspection.missingPaymentBookings.length,
              },
            ],
          )
        }

        if (
          inspection.abnormalPaymentBookings.length > 0
        ) {
          throw new HttpError(
            `Có ${inspection.abnormalPaymentBookings.length} vé có trạng thái thanh toán bất thường hoặc đã hoàn tiền. Hãy xử lý từng vé trước.`,
            409,
            [
              {
                field: 'payments',
                code: 'ABNORMAL_PAYMENT_STATUS',
                count:
                  inspection.abnormalPaymentBookings.length,
              },
            ],
          )
        }

        if (
          inspection.unpaidBookingCount > 0 &&
          options.confirmCollectUnpaid !== true
        ) {
          throw new HttpError(
            `Chuyến còn ${inspection.unpaidBookingCount} vé chưa thanh toán. Cần xác nhận đã thu tiền các vé này trước khi hoàn thành chuyến.`,
            409,
            [
              {
                field: 'confirmCollectUnpaid',
                code: 'UNPAID_TICKETS',
                count:
                  inspection.unpaidBookingCount,
                amount:
                  inspection.unpaidAmount,
              },
            ],
          )
        }

        const completionTime =
          new Date()

        for (
          const booking of
            inspection.unpaidBookings
        ) {
          await transaction.payment.update({
            where: {
              id: booking.payment.id,
            },

            data: {
              status: 'SUCCESS',
              amount: booking.totalAmount,
              paidAt: completionTime,
            },
          })

          await transaction.booking.update({
            where: {
              id: booking.id,
            },

            data: {
              paymentStatus: 'SUCCESS',
            },
          })

          collectedBookingCount += 1
          collectedAmount +=
            Number(booking.totalAmount || 0)

          if (actor) {
            await writeAuditLog(
              {
                userId:
                  actor.id,

                role:
                  actor.role,

                action:
                  'PAYMENT_SUCCESS',

                entityType:
                  'BOOKING',

                entityId:
                  booking.id,

                description:
                  `Xác nhận đã thu ${Number(
                    booking.totalAmount || 0,
                  ).toLocaleString('vi-VN')} đồng cho vé ${booking.bookingCode} khi hoàn thành chuyến.`,

                reason:
                  'Thu tiền hàng loạt khi hoàn thành chuyến',

                metadata: {
                  tripId,
                  bookingCode:
                    booking.bookingCode,
                  paymentId:
                    booking.payment.id,
                  paymentMethod:
                    booking.payment.paymentMethod,
                  amount:
                    Number(booking.totalAmount || 0),
                },
              },
              transaction,
            )
          }
        }

        const [
          completedResult,
          noShowCount,
          pendingCount,
        ] = await Promise.all([
          transaction.booking.updateMany({
            where: {
              tripId,
              status: 'CONFIRMED',
            },

            data: {
              status: 'COMPLETED',
            },
          }),

          transaction.booking.count({
            where: {
              tripId,
              status: 'NO_SHOW',
            },
          }),

          transaction.booking.count({
            where: {
              tripId,
              status: 'PENDING',
            },
          }),
        ])

        completedBookingCount =
          completedResult.count

        noShowBookingCount =
          noShowCount

        pendingBookingCount =
          pendingCount
      }

      const updatedTrip =
        await transaction.trip.update({
          where: {
            id: tripId,
          },

          data: {
            status: nextStatus,
          },

          include:
            tripInclude,
        })

      if (actor) {
        let description =
          `Chuyển trạng thái chuyến xe từ ` +
          `"${getTripStatusLabel(
            trip.status,
          )}" sang ` +
          `"${getTripStatusLabel(
            nextStatus,
          )}"`

        if (
          nextStatus ===
          'COMPLETED'
        ) {
          description =
            `Hoàn thành chuyến xe. ` +
            `${completedBookingCount} vé được chuyển sang trạng thái đã hoàn thành, ` +
            `${collectedBookingCount} vé được xác nhận đã thu tiền với tổng ${collectedAmount.toLocaleString('vi-VN')} đồng, ` +
            `${noShowBookingCount} vé không đi và ` +
            `${pendingBookingCount} vé chờ xử lý nghiệp vụ.`
        }

        await writeAuditLog(
          {
            userId:
              actor.id,

            role:
              actor.role,

            action:
              nextStatus ===
              'CANCELLED'
                ? 'CANCEL_TRIP'
                : 'UPDATE_TRIP_STATUS',

            entityType:
              'TRIP',

            entityId:
              tripId,

            description,

            metadata: {
              previousStatus:
                trip.status,

              newStatus:
                nextStatus,

              ...(nextStatus ===
                'COMPLETED' && {
                completedBookingCount,
                collectedBookingCount,
                collectedAmount,
                noShowBookingCount,
                pendingBookingCount,
              }),
            },
          },

          transaction,
        )
      }

      return {
        ...updatedTrip,

        ...(nextStatus ===
          'COMPLETED' && {
          completionSummary: {
            completedBookings:
              completedBookingCount,

            collectedBookings:
              collectedBookingCount,

            collectedAmount,

            noShowBookings:
              noShowBookingCount,

            pendingBookings:
              pendingBookingCount,
          },
        }),
      }
    },
  )

const getTripPassengerList =
  async (
    tripId,
    actor = null,
  ) => {
    const isAdmin =
      actor?.role === 'ADMIN'

    const trip =
      await prisma.trip.findUnique({
        where: {
          id: tripId,
        },

        include:
          tripInclude,
      })

    if (!trip) {
      throw new HttpError(
        'Không tìm thấy chuyến xe',
        404,
      )
    }

    const validStatuses = [
      'PENDING',
      'CONFIRMED',
      'COMPLETED',
    ]

    const [
      bookings,
      bookedSeats,
      successfulPayments,
    ] = await Promise.all([
      prisma.booking.findMany({
        where: {
          tripId,

          status: {
            not: 'DELETED',
          },
        },

        select: {
          id: true,
          bookingCode: true,
          source: true,
          passengerFullName: true,
          passengerPhone: true,
          passengerEmail: true,
          customerNote: true,
          staffNote: true,
          pickupPoint: true,
          dropoffPoint: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          cancellationReason: true,
          noShowReason: true,
          createdAt: true,

          items: {
            select: {
              seatCode: true,
              seatType: true,
              price: true,
            },

            orderBy: {
              seatCode: 'asc',
            },
          },

          payments: {
            select: {
              paymentMethod: true,
              status: true,
              amount: true,
              transactionCode: true,
              paidAt: true,
              createdAt: true,
            },

            orderBy: {
              createdAt: 'desc',
            },

            take: 1,
          },
        },

        orderBy: {
          createdAt: 'asc',
        },
      }),

      prisma.tripSeat.count({
        where: {
          tripId,
          status: 'BOOKED',
        },
      }),

      isAdmin
        ? prisma.payment.aggregate({
            where: {
              status: 'SUCCESS',

              booking: {
                tripId,
              },
            },

            _sum: {
              amount: true,
            },

            _count: true,
          })
        : Promise.resolve(null),
    ])

    const validBookings =
      bookings.filter(
        (booking) =>
          validStatuses.includes(
            booking.status,
          ),
      )

    return {
      trip: {
        id:
          trip.id,

        status:
          trip.status,

        departureTime:
          trip.departureTime,

        expectedArrivalTime:
          trip.expectedArrivalTime,

        route:
          trip.route,

        bus:
          trip.bus,
      },

      summary: {
        totalBookings:
          bookings.length,

        validBookings:
          validBookings.length,

        bookedSeats,

        capacity:
          trip.bus?.capacity ??
          0,
      },

      finance:
        isAdmin &&
        successfulPayments
          ? {
              collectedRevenue:
                Number(
                  successfulPayments
                    ._sum.amount ||
                    0,
                ),

              successfulPayments:
                successfulPayments
                  ._count,
            }
          : null,

      passengers:
        bookings.map(
          (
            booking,
            index,
          ) => ({
            orderNumber:
              index + 1,

            id:
              booking.id,

            bookingCode:
              booking.bookingCode,

            source:
              booking.source,

            passengerFullName:
              booking.passengerFullName,

            passengerPhone:
              booking.passengerPhone,

            passengerEmail:
              booking.passengerEmail,

            seats:
              booking.items.map(
                (item) => ({
                  ...item,

                  price:
                    Number(
                      item.price ||
                      0,
                    ),
                }),
              ),

            totalAmount:
              Number(
                booking.totalAmount ||
                0,
              ),

            status:
              booking.status,

            paymentStatus:
              booking.paymentStatus,

            payment:
              booking.payments[0]
                ? {
                    ...booking
                      .payments[0],

                    amount:
                      Number(
                        booking
                          .payments[0]
                          .amount ||
                          0,
                      ),
                  }
                : null,

            customerNote:
              booking.customerNote,

            staffNote:
              booking.staffNote,

            pickupPoint:
              booking.pickupPoint,

            dropoffPoint:
              booking.dropoffPoint,

            cancellationReason:
              booking
                .cancellationReason,

            noShowReason:
              booking.noShowReason,

            createdAt:
              booking.createdAt,
          }),
        ),
    }
  }

const cancelTrip = (
  tripId,
  actor = null,
) =>
  changeTripStatus(
    tripId,
    'CANCELLED',
    actor,
  )

export {
  cancelTrip,
  changeTripStatus,
  createTrip,
  getTripById,
  getTripCompletionPreview,
  getTripPassengerList,
  getTrips,
  updateTrip,
}
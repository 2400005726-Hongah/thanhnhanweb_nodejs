import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import AdminPageHeader from '../../components/admin/AdminPageHeader.jsx'
import AdminRoutesSummaryPage from './AdminRoutesSummaryPage.jsx'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/StatusState.jsx'
import { useAuth } from '../../contexts/authContext.js'
import {
  changeTripStatus,
  configureTripServicePoints,
  createTrip,
  deleteTrip,
  getBuses,
  getLocationCatalog,
  getTrip,
  getTripCompletionPreview,
  getTripServicePoints,
  getTrips,
  updateTrip,
} from '../../services/admin.service.js'
import { getApiErrorMessage } from '../../services/apiClient.js'
import { hasPermission, PERMISSIONS } from '../../utils/adminPermissions.js'
import { getBusTypeLabel, isRoomBusType } from '../../utils/busTypes.js'
import formatCurrency from '../../utils/formatCurrency.js'
import { formatDateTime } from '../../utils/formatDateTime.js'
import { formatLicensePlate } from '../../utils/normalizers.js'

import './AdminTripsRoutesPage.css'

const TRIP_PAGE_SIZE = 30

const TRIP_STATUS_LABELS = {
  OPEN: 'Đang mở bán',
  CLOSED: 'Đã đóng đặt vé',
  DEPARTED: 'Đã khởi hành',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
}

const EMPTY_TRIP_FILTERS = {
  status: '',
  departureDate: '',
}

const EMPTY_TRIP_FORM = {
  departureProvinceId: '',
  departureLocationId: '',
  arrivalProvinceId: '',
  arrivalLocationId: '',
  bus: '',
  departureTime: '',
  expectedArrivalTime: '',
  ticketPrice: '',
  singleRoomPrice: '',
  doubleRoomPrice: '',
  status: 'OPEN',
}

const EMPTY_SERVICE_CONFIG = {
  primaryPickupMode: 'DonTaiBenXe',
  primaryDropoffMode: 'TraTaiBenXe',
  allowPickupTransfer: false,
  allowPickupMeetingPoint: false,
  allowDropoffTransfer: false,
  allowDropoffStop: false,
  meetingPoints: [],
  dropoffStops: [],
}

let serviceRowSequence = 0
const createServiceRowId = () => {
  serviceRowSequence += 1
  return `service-row-${Date.now()}-${serviceRowSequence}`
}

const toTimeInput = (value) => {
  if (!value) return ''
  const raw = String(value)
  const match = raw.match(/(?:T|^)(\d{2}:\d{2})/)
  return match?.[1] || raw.slice(0, 5)
}

const createServiceRow = (pointType, locationId = '', options = {}) => ({
  clientId: options.clientId || options.id || createServiceRowId(),
  id: options.id || '',
  locationId,
  pointType,
  serviceMode: pointType === 'PICKUP' ? 'DonTaiDiemHen' : 'TraTaiDiemDung',
  estimatedTime: options.estimatedTime || '',
  sortOrder: String(options.sortOrder ?? 1),
})

const shortCode = (id, prefix) =>
  `${prefix}-${String(id || '').split('-')[0].toUpperCase()}`

const toLocalDateTimeInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, '0')
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('')
}

const nullableNumber = (value) => {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : Number.NaN
}

const getTripStatusClass = (status) => {
  if (status === 'CANCELLED') return 'status-badge status-badge--cancelled'
  if (status === 'COMPLETED') return 'status-badge status-badge--completed'
  if (status === 'DEPARTED' || status === 'CLOSED') {
    return 'status-badge status-badge--pending'
  }
  return 'status-badge status-badge--active'
}

const getEffectiveTripStatus = (trip, now = new Date()) => {
  if (['COMPLETED', 'CANCELLED'].includes(trip.status)) return trip.status
  return new Date(trip.departureTime) <= now ? 'DEPARTED' : trip.status
}

const locationProvinceId = (location) =>
  location?.provinceId || location?.provinceRef?.id || null

const locationProvinceName = (location) =>
  location?.provinceRef?.name || location?.province || 'Chưa xác định'


const formatAdminDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const formatAdminTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const isToday = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

const getTripCapacity = (trip) => {
  const direct = Number(
    trip?.seatStats?.total ??
    trip?.bus?.seatCount ??
    trip?.bus?.capacity ??
    trip?.bus?.totalSeats,
  )
  if (Number.isFinite(direct) && direct > 0) return direct

  const available = Number(trip?.seatStats?.available ?? 0)
  const booked = Number(trip?.seatStats?.booked ?? 0)
  const held = Number(trip?.seatStats?.held ?? 0)
  const calculated = available + booked + held
  return calculated > 0 ? calculated : 0
}

const getJourneyDayBadge = (trip, effectiveStatus) => {
  if (effectiveStatus === 'COMPLETED') return { label: 'Hoàn thành', className: 'is-completed' }
  if (effectiveStatus === 'CANCELLED') return { label: 'Đã hủy', className: 'is-cancelled' }
  if (effectiveStatus === 'DEPARTED') return { label: 'Đã khởi hành', className: 'is-departed' }
  if (isToday(trip.departureTime)) return { label: 'Hôm nay', className: 'is-today' }
  return null
}

function AdminTripsRoutesPage({ pageMode = 'list' }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tripId } = useParams()
  const isFormPage = pageMode !== 'list'
  const editLoadRef = useRef('')

  const [trips, setTrips] = useState([])
  const [tripPage, setTripPage] = useState(1)
  const [tripPagination, setTripPagination] = useState(null)
  const [tripFilters, setTripFilters] = useState({ ...EMPTY_TRIP_FILTERS })
  const [appliedTripFilters, setAppliedTripFilters] = useState({
    ...EMPTY_TRIP_FILTERS,
  })

  const [buses, setBuses] = useState([])
  const [catalog, setCatalog] = useState({ provinces: [], locations: [] })
  const [editingTrip, setEditingTrip] = useState(null)
  const [tripForm, setTripForm] = useState({ ...EMPTY_TRIP_FORM })
  const [serviceConfig, setServiceConfig] = useState({ ...EMPTY_SERVICE_CONFIG })

  const [loading, setLoading] = useState(true)
  const [submittingTrip, setSubmittingTrip] = useState(false)
  const [error, setError] = useState('')
  const [processingTripId, setProcessingTripId] = useState('')
  const [showTripFilters, setShowTripFilters] = useState(false)
  const [formSections, setFormSections] = useState(() => ({
    route: pageMode === 'create',
    pickup: true,
    dropoff: false,
    operation: true,
  }))
  const [formRecordLoading, setFormRecordLoading] = useState(pageMode === 'edit')

  const canCreateTrips = hasPermission(user, PERMISSIONS.CREATE_TRIPS)
  const canEditTrips = hasPermission(user, PERMISSIONS.EDIT_TRIPS)
  const canDeleteTrips = hasPermission(user, PERMISSIONS.DELETE_TRIPS)
  const canViewRoutes = hasPermission(user, PERMISSIONS.VIEW_ROUTES)

  const selectedTripBus = useMemo(
    () => buses.find((bus) => bus.id === tripForm.bus),
    [buses, tripForm.bus],
  )

  const activeProvinces = useMemo(
    () =>
      [...catalog.provinces]
        .filter((province) => province.status === 'ACTIVE')
        .sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    [catalog.provinces],
  )

  const departureLocations = useMemo(
    () =>
      catalog.locations
        .filter(
          (location) =>
            location.status === 'ACTIVE' &&
            location.defaultAreaId &&
            location.defaultArea?.status !== 'INACTIVE' &&
            locationProvinceId(location) === tripForm.departureProvinceId &&
            ['PICKUP', 'BOTH'].includes(location.locationType),
        )
        .sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    [catalog.locations, tripForm.departureProvinceId],
  )

  const arrivalLocations = useMemo(
    () =>
      catalog.locations
        .filter(
          (location) =>
            location.status === 'ACTIVE' &&
            location.defaultAreaId &&
            location.defaultArea?.status !== 'INACTIVE' &&
            locationProvinceId(location) === tripForm.arrivalProvinceId &&
            ['DROPOFF', 'BOTH'].includes(location.locationType),
        )
        .sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    [catalog.locations, tripForm.arrivalProvinceId],
  )

  const pickupMeetingCatalog = useMemo(() => {
    const existingIds = new Set(serviceConfig.meetingPoints.map((point) => point.locationId))
    return catalog.locations
      .filter(
        (location) =>
          locationProvinceId(location) === tripForm.departureProvinceId &&
          ['PICKUP', 'BOTH'].includes(location.locationType) &&
          location.id !== tripForm.departureLocationId &&
          (
            existingIds.has(location.id) ||
            (
              location.status === 'ACTIVE' &&
              location.isDeleted !== true &&
              location.defaultArea?.status !== 'INACTIVE'
            )
          ),
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [catalog.locations, serviceConfig.meetingPoints, tripForm.departureLocationId, tripForm.departureProvinceId])

  const dropoffStopCatalog = useMemo(() => {
    const existingIds = new Set(serviceConfig.dropoffStops.map((point) => point.locationId))
    return catalog.locations
      .filter(
        (location) =>
          locationProvinceId(location) === tripForm.arrivalProvinceId &&
          ['DROPOFF', 'BOTH'].includes(location.locationType) &&
          location.id !== tripForm.arrivalLocationId &&
          (
            existingIds.has(location.id) ||
            (
              location.status === 'ACTIVE' &&
              location.isDeleted !== true &&
              location.defaultArea?.status !== 'INACTIVE'
            )
          ),
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [catalog.locations, serviceConfig.dropoffStops, tripForm.arrivalLocationId, tripForm.arrivalProvinceId])

  const load = useCallback(async (targetPage = 1, filters = EMPTY_TRIP_FILTERS) => {
    setLoading(true)
    setError('')
    try {
      if (isFormPage) {
        const [busData, locationData] = await Promise.all([
          getBuses({ page: 1, limit: 100 }),
          getLocationCatalog(),
        ])
        setBuses(busData?.buses ?? [])
        setCatalog({
          provinces: locationData?.provinces ?? [],
          locations: locationData?.locations ?? [],
        })
        return
      }

      const [tripData, busData, locationData] = await Promise.all([
        getTrips({
          page: targetPage,
          limit: TRIP_PAGE_SIZE,
          sort: 'asc',
          ...(filters.status && { status: filters.status }),
          ...(filters.departureDate && { departureDate: filters.departureDate }),
        }),
        getBuses({ page: 1, limit: 100 }),
        getLocationCatalog(),
      ])

      setTrips(tripData?.trips ?? [])
      setTripPagination(
        tripData?.pagination ?? {
          page: targetPage,
          limit: TRIP_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        },
      )
      setBuses(busData?.buses ?? [])
      setCatalog({
        provinces: locationData?.provinces ?? [],
        locations: locationData?.locations ?? [],
      })
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [isFormPage])

  useEffect(() => {
    load(tripPage, appliedTripFilters)
  }, [appliedTripFilters, load, tripPage])

  const resetTripForm = () => {
    if (isFormPage) {
      navigate('/admin/chuyen-xe')
      return
    }
    setEditingTrip(null)
    setTripForm({ ...EMPTY_TRIP_FORM })
    setServiceConfig({ ...EMPTY_SERVICE_CONFIG })
  }

  const openEditTrip = async (trip) => {
    const departureLocation = trip.departureLocation || trip.route?.departureLocation || null
    const arrivalLocation = trip.arrivalLocation || trip.route?.arrivalLocation || null

    setProcessingTripId(trip.id)
    try {
      let serviceData = null
      try {
        serviceData = await getTripServicePoints(trip.id)
      } catch {
        // Chuyến cũ chưa từng cấu hình vẫn mở được form sửa với giá trị mặc định.
      }

      const serviceTrip = serviceData?.trip || trip
      const servicePoints = serviceData?.servicePoints ?? []
      const meetingPoints = servicePoints
        .filter(
          (point) =>
            point.status === 'ACTIVE' &&
            point.isDefault !== true &&
            point.pointType === 'PICKUP' &&
            point.serviceMode === 'DonTaiDiemHen',
        )
        .map((point, index) =>
          createServiceRow('PICKUP', point.locationId || point.location?.id || '', {
            id: point.id,
            estimatedTime: toTimeInput(point.estimatedTime),
            sortOrder: point.sortOrder ?? index + 2,
          }),
        )
      const dropoffStops = servicePoints
        .filter(
          (point) =>
            point.status === 'ACTIVE' &&
            point.isDefault !== true &&
            point.pointType === 'DROPOFF' &&
            point.serviceMode === 'TraTaiDiemDung',
        )
        .map((point, index) =>
          createServiceRow('DROPOFF', point.locationId || point.location?.id || '', {
            id: point.id,
            estimatedTime: toTimeInput(point.estimatedTime),
            sortOrder: point.sortOrder ?? index + 2,
          }),
        )

      setEditingTrip(trip)
      setTripForm({
        departureProvinceId:
          trip.departureProvince?.id || locationProvinceId(departureLocation) || '',
        departureLocationId: departureLocation?.id || '',
        arrivalProvinceId:
          trip.arrivalProvince?.id || locationProvinceId(arrivalLocation) || '',
        arrivalLocationId: arrivalLocation?.id || '',
        bus: trip.bus?.id ?? trip.busId ?? '',
        departureTime: toLocalDateTimeInput(trip.departureTime),
        expectedArrivalTime: toLocalDateTimeInput(trip.expectedArrivalTime),
        ticketPrice: trip.ticketPrice == null ? '' : String(Number(trip.ticketPrice)),
        singleRoomPrice:
          trip.singleRoomPrice == null ? '' : String(Number(trip.singleRoomPrice)),
        doubleRoomPrice:
          trip.doubleRoomPrice == null ? '' : String(Number(trip.doubleRoomPrice)),
        status: trip.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
      })
      setServiceConfig({
        primaryPickupMode: serviceTrip.primaryPickupMode || 'DonTaiBenXe',
        primaryDropoffMode: serviceTrip.primaryDropoffMode || 'TraTaiBenXe',
        allowPickupTransfer: serviceTrip.allowPickupTransfer === true,
        allowPickupMeetingPoint:
          serviceTrip.allowPickupMeetingPoint === true || meetingPoints.length > 0,
        allowDropoffTransfer: serviceTrip.allowDropoffTransfer === true,
        allowDropoffStop: serviceTrip.allowDropoffStop === true || dropoffStops.length > 0,
        meetingPoints,
        dropoffStops,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingTripId('')
    }
  }

  useEffect(() => {
    if (pageMode !== 'create') return
    setEditingTrip(null)
    setTripForm({ ...EMPTY_TRIP_FORM })
    setServiceConfig({ ...EMPTY_SERVICE_CONFIG })
    setFormSections({ route: true, pickup: true, dropoff: false, operation: true })
    setFormRecordLoading(false)
  }, [pageMode])

  useEffect(() => {
    if (pageMode !== 'edit' || !tripId || editLoadRef.current === tripId) return
    editLoadRef.current = tripId
    setFormSections({ route: false, pickup: true, dropoff: false, operation: true })
    let cancelled = false

    const loadTripForEdit = async () => {
      setFormRecordLoading(true)
      try {
        const result = await getTrip(tripId)
        const trip = result?.trip || result
        if (!trip?.id) throw new Error('Không tìm thấy chuyến xe cần sửa.')
        if (!cancelled) await openEditTrip(trip)
      } catch (requestError) {
        if (!cancelled) setError(getApiErrorMessage(requestError))
      } finally {
        if (!cancelled) setFormRecordLoading(false)
      }
    }

    loadTripForEdit()
    return () => { cancelled = true }
    // openEditTrip intentionally uses current form helpers; route id is the reload key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMode, tripId])

  const toggleFormSection = (section) => {
    setFormSections((current) => ({ ...current, [section]: !current[section] }))
  }

  const changeTripField = (event) => {
    const { name, value } = event.target
    setTripForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'departureProvinceId' ? { departureLocationId: '' } : {}),
      ...(name === 'arrivalProvinceId' ? { arrivalLocationId: '' } : {}),
    }))

    if (name === 'departureProvinceId') {
      setServiceConfig((current) => ({ ...current, meetingPoints: [] }))
    }
    if (name === 'arrivalProvinceId') {
      setServiceConfig((current) => ({ ...current, dropoffStops: [] }))
    }
    if (name === 'departureLocationId') {
      setServiceConfig((current) => ({
        ...current,
        meetingPoints: current.meetingPoints.filter((point) => point.locationId !== value),
      }))
    }
    if (name === 'arrivalLocationId') {
      setServiceConfig((current) => ({
        ...current,
        dropoffStops: current.dropoffStops.filter((point) => point.locationId !== value),
      }))
    }
  }

  const setServiceSetting = (name, value) => {
    setServiceConfig((current) => ({ ...current, [name]: value }))
  }

  const addMeetingPoint = () => {
    const used = new Set(serviceConfig.meetingPoints.map((point) => point.locationId))
    const location = pickupMeetingCatalog.find((item) => !used.has(item.id))
    if (!location) {
      window.alert('Không còn địa điểm đón phù hợp để thêm làm điểm hẹn.')
      return
    }
    setServiceConfig((current) => ({
      ...current,
      meetingPoints: [
        ...current.meetingPoints,
        createServiceRow('PICKUP', location.id, {
          sortOrder: current.meetingPoints.length + 2,
        }),
      ],
    }))
  }

  const addDropoffStop = () => {
    const used = new Set(serviceConfig.dropoffStops.map((point) => point.locationId))
    const location = dropoffStopCatalog.find((item) => !used.has(item.id))
    if (!location) {
      window.alert('Không còn địa điểm trả phù hợp để thêm làm điểm dừng.')
      return
    }
    setServiceConfig((current) => ({
      ...current,
      dropoffStops: [
        ...current.dropoffStops,
        createServiceRow('DROPOFF', location.id, {
          sortOrder: current.dropoffStops.length + 2,
        }),
      ],
    }))
  }

  const updateServiceRow = (key, rowIndex, field, value) => {
    setServiceConfig((current) => ({
      ...current,
      [key]: current[key].map((point, index) =>
        index === rowIndex ? { ...point, [field]: value } : point,
      ),
    }))
  }

  const removeServiceRow = (key, rowIndex) => {
    setServiceConfig((current) => ({
      ...current,
      [key]: current[key]
        .filter((_, index) => index !== rowIndex)
        .map((point, index) => ({ ...point, sortOrder: String(index + 2) })),
    }))
  }

  const availableLocationsForRow = (items, rows, rowIndex) => {
    const used = new Set(
      rows
        .filter((_, index) => index !== rowIndex)
        .map((point) => point.locationId)
        .filter(Boolean),
    )
    return items.filter((location) => !used.has(location.id))
  }

  const buildServicePointPayload = () => ({
    primaryPickupMode: serviceConfig.primaryPickupMode,
    primaryDropoffMode: serviceConfig.primaryDropoffMode,
    allowPickupTransfer: serviceConfig.allowPickupTransfer,
    allowPickupMeetingPoint: serviceConfig.allowPickupMeetingPoint,
    allowDropoffTransfer: serviceConfig.allowDropoffTransfer,
    allowDropoffStop: serviceConfig.allowDropoffStop,
    servicePoints: [
      ...(serviceConfig.allowPickupMeetingPoint
        ? serviceConfig.meetingPoints.map((point, index) => ({
            ...(point.id && { id: point.id }),
            locationId: point.locationId,
            pointType: 'PICKUP',
            serviceMode: 'DonTaiDiemHen',
            estimatedTime: point.estimatedTime,
            sortOrder: Number(point.sortOrder || index + 2),
            status: 'ACTIVE',
          }))
        : []),
      ...(serviceConfig.allowDropoffStop
        ? serviceConfig.dropoffStops.map((point, index) => ({
            ...(point.id && { id: point.id }),
            locationId: point.locationId,
            pointType: 'DROPOFF',
            serviceMode: 'TraTaiDiemDung',
            estimatedTime: point.estimatedTime,
            sortOrder: Number(point.sortOrder || index + 2),
            status: 'ACTIVE',
          }))
        : []),
    ],
  })

  const submitTrip = async (event) => {
    event.preventDefault()

    if (
      !tripForm.departureProvinceId ||
      !tripForm.departureLocationId ||
      !tripForm.arrivalProvinceId ||
      !tripForm.arrivalLocationId ||
      !tripForm.bus
    ) {
      window.alert('Vui lòng chọn đầy đủ tỉnh/thành, địa điểm cụ thể và xe.')
      return
    }
    if (tripForm.departureProvinceId === tripForm.arrivalProvinceId) {
      window.alert('Tỉnh/Thành đi phải khác Tỉnh/Thành đến.')
      return
    }
    if (tripForm.departureLocationId === tripForm.arrivalLocationId) {
      window.alert('Điểm đi cụ thể phải khác điểm đến cụ thể.')
      return
    }

    if (serviceConfig.allowPickupMeetingPoint && serviceConfig.meetingPoints.length === 0) {
      window.alert('Bạn đã bật Đón khách tại điểm hẹn. Hãy thêm ít nhất một điểm hẹn.')
      return
    }
    if (serviceConfig.allowDropoffStop && serviceConfig.dropoffStops.length === 0) {
      window.alert('Bạn đã bật Trả khách tại điểm dừng. Hãy thêm ít nhất một điểm dừng.')
      return
    }
    const activeServiceRows = [
      ...(serviceConfig.allowPickupMeetingPoint ? serviceConfig.meetingPoints : []),
      ...(serviceConfig.allowDropoffStop ? serviceConfig.dropoffStops : []),
    ]
    if (activeServiceRows.some((point) => !point.locationId || !point.estimatedTime)) {
      window.alert('Vui lòng chọn đầy đủ địa điểm và giờ dự kiến cho điểm hẹn/điểm dừng.')
      return
    }
    if (activeServiceRows.some((point) => {
      const sortOrder = Number(point.sortOrder)
      return !Number.isInteger(sortOrder) || sortOrder < 0
    })) {
      window.alert('Thứ tự điểm hẹn/điểm dừng phải là số nguyên không âm.')
      return
    }

    const departureTime = new Date(tripForm.departureTime)
    const expectedArrivalTime = new Date(tripForm.expectedArrivalTime)
    if (Number.isNaN(departureTime.getTime())) {
      window.alert('Vui lòng nhập thời gian khởi hành.')
      return
    }
    if (
      Number.isNaN(expectedArrivalTime.getTime()) ||
      expectedArrivalTime <= departureTime
    ) {
      window.alert('Thời gian dự kiến đến phải sau thời gian khởi hành.')
      return
    }

    const ticketPrice = nullableNumber(tripForm.ticketPrice)
    const singleRoomPrice = nullableNumber(tripForm.singleRoomPrice)
    const doubleRoomPrice = nullableNumber(tripForm.doubleRoomPrice)
    if ([ticketPrice, singleRoomPrice, doubleRoomPrice].some(Number.isNaN)) {
      window.alert('Giá vé phải là số không âm.')
      return
    }

    if (isRoomBusType(selectedTripBus?.busType)) {
      if (singleRoomPrice == null || doubleRoomPrice == null) {
        window.alert('Xe 22 phòng phải nhập giá phòng đơn và giá phòng đôi.')
        return
      }
    } else if (ticketPrice == null) {
      window.alert('Vui lòng nhập giá vé cho chuyến.')
      return
    }

    setSubmittingTrip(true)
    let newlyCreatedTripId = ''
    try {
      const common = {
        departureProvinceId: tripForm.departureProvinceId,
        arrivalProvinceId: tripForm.arrivalProvinceId,
        ticketPrice,
        singleRoomPrice,
        doubleRoomPrice,
      }

      if (editingTrip) {
        const oldDeparture =
          editingTrip.departureLocation?.id || editingTrip.route?.departureLocation?.id || ''
        const oldArrival =
          editingTrip.arrivalLocation?.id || editingTrip.route?.arrivalLocation?.id || ''
        const oldBus = editingTrip.bus?.id ?? editingTrip.busId ?? ''
        const payload = {
          ...common,
          ...(tripForm.departureLocationId !== oldDeparture && {
            departureLocationId: tripForm.departureLocationId,
          }),
          ...(tripForm.arrivalLocationId !== oldArrival && {
            arrivalLocationId: tripForm.arrivalLocationId,
          }),
          ...(tripForm.bus !== oldBus && { bus: tripForm.bus }),
          ...(departureTime.getTime() !== new Date(editingTrip.departureTime).getTime() && {
            departureTime: departureTime.toISOString(),
          }),
          ...(expectedArrivalTime.getTime() !==
            new Date(editingTrip.expectedArrivalTime).getTime() && {
            expectedArrivalTime: expectedArrivalTime.toISOString(),
          }),
        }
        await updateTrip(editingTrip.id, payload)
        await configureTripServicePoints(editingTrip.id, buildServicePointPayload())
      } else {
        const created = await createTrip({
          ...common,
          departureLocationId: tripForm.departureLocationId,
          arrivalLocationId: tripForm.arrivalLocationId,
          bus: tripForm.bus,
          departureTime: departureTime.toISOString(),
          expectedArrivalTime: expectedArrivalTime.toISOString(),
          status: tripForm.status,
        })
        const createdTripId = created?.trip?.id || created?.id
        if (!createdTripId) {
          throw new Error('Đã tạo chuyến nhưng không nhận được mã chuyến để lưu cấu hình điểm đón/trả.')
        }
        newlyCreatedTripId = createdTripId
        await configureTripServicePoints(createdTripId, buildServicePointPayload())
      }

      if (isFormPage) {
        navigate('/admin/chuyen-xe', { replace: true })
      } else {
        resetTripForm()
        await load(tripPage, appliedTripFilters)
      }
    } catch (requestError) {
      if (newlyCreatedTripId) {
        window.alert(
          `Chuyến đã được tạo nhưng cấu hình điểm đón/trả chưa lưu hoàn tất.\n\n${getApiErrorMessage(requestError)}\n\nHãy bấm Sửa chuyến vừa tạo để lưu lại cấu hình điểm đón/trả.`,
        )
        if (isFormPage) {
          navigate(`/admin/chuyen-xe/${newlyCreatedTripId}/sua`, { replace: true })
        } else {
          await load(tripPage, appliedTripFilters)
        }
      } else {
        window.alert(getApiErrorMessage(requestError))
      }
    } finally {
      setSubmittingTrip(false)
    }
  }

  const updateStatus = async (trip, nextStatus) => {
    const nextLabel = TRIP_STATUS_LABELS[nextStatus] || 'Không xác định'
    if (
      !window.confirm(
        `Chuyển chuyến ${shortCode(trip.id, 'CX')} sang trạng thái "${nextLabel}"?`,
      )
    ) return

    setProcessingTripId(trip.id)
    try {
      await changeTripStatus(trip.id, nextStatus)
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingTripId('')
    }
  }

  const completeTrip = async (trip) => {
    setProcessingTripId(trip.id)
    try {
      const previewData = await getTripCompletionPreview(trip.id)
      const preview = previewData.preview

      if (!preview.canComplete) {
        if (preview.missingPaymentCount > 0) {
          window.alert(
            `Có ${preview.missingPaymentCount} vé thiếu dữ liệu thanh toán. Hãy kiểm tra danh sách hành khách trước.`,
          )
          return
        }
        if (preview.abnormalPaymentCount > 0) {
          window.alert(
            `Có ${preview.abnormalPaymentCount} vé có trạng thái thanh toán bất thường hoặc đã hoàn tiền.`,
          )
          return
        }
      }

      const confirmMessage =
        preview.unpaidBookingCount > 0
          ? `Chuyến còn ${preview.unpaidBookingCount} vé chưa thanh toán, tổng ${formatCurrency(
              preview.unpaidAmount,
            )}.\n\nNếu tiếp tục, các vé hợp lệ chưa thanh toán sẽ được chuyển thành Đã thanh toán.\n\nBạn có chắc muốn hoàn thành chuyến?`
          : 'Tất cả vé hiệu lực đã thanh toán. Bạn có chắc muốn hoàn thành chuyến?'

      if (!window.confirm(confirmMessage)) return

      const result = await changeTripStatus(trip.id, 'COMPLETED', {
        confirmCollectUnpaid: preview.unpaidBookingCount > 0,
      })
      const summary = result.trip?.completionSummary
      if (summary?.collectedBookings > 0) {
        window.alert(
          `Đã hoàn thành chuyến và xác nhận thanh toán ${summary.collectedBookings} vé, tổng ${formatCurrency(
            summary.collectedAmount,
          )}.`,
        )
      } else {
        window.alert('Đã hoàn thành chuyến xe.')
      }
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingTripId('')
    }
  }

  const removeTrip = async (trip) => {
    if (!window.confirm(`Hủy chuyến ${shortCode(trip.id, 'CX')}?`)) return
    setProcessingTripId(trip.id)
    try {
      await deleteTrip(trip.id)
      await load(tripPage, appliedTripFilters)
    } catch (requestError) {
      window.alert(getApiErrorMessage(requestError))
    } finally {
      setProcessingTripId('')
    }
  }

  const submitTripFilters = (event) => {
    event.preventDefault()
    setTripPage(1)
    setAppliedTripFilters({ ...tripFilters })
  }

  const clearTripFilters = () => {
    setTripFilters({ ...EMPTY_TRIP_FILTERS })
    setAppliedTripFilters({ ...EMPTY_TRIP_FILTERS })
    setTripPage(1)
  }

  const selectedDepartureLocation = catalog.locations.find(
    (location) => location.id === tripForm.departureLocationId,
  )
  const selectedArrivalLocation = catalog.locations.find(
    (location) => location.id === tripForm.arrivalLocationId,
  )
  const selectedDepartureProvince = catalog.provinces.find(
    (province) => province.id === tripForm.departureProvinceId,
  )
  const selectedArrivalProvince = catalog.provinces.find(
    (province) => province.id === tripForm.arrivalProvinceId,
  )

  const formSectionSummary = {
    route:
      selectedDepartureProvince && selectedArrivalProvince
        ? `${selectedDepartureProvince.name} → ${selectedArrivalProvince.name}`
        : 'Chọn tuyến và điểm đi/đến',
    pickup:
      serviceConfig.primaryPickupMode === 'TaiVanPhong'
        ? 'Tập trung tại văn phòng nhà xe'
        : 'Đón trực tiếp tại bến xe trung tâm',
    dropoff:
      serviceConfig.primaryDropoffMode === 'TraTaiVanPhong'
        ? 'Trả tại văn phòng nhà xe'
        : 'Trả tại bến xe trung tâm đích đến',
    operation:
      selectedTripBus && tripForm.departureTime
        ? `${formatLicensePlate(selectedTripBus.licensePlate)} · ${formatDateTime(tripForm.departureTime)}`
        : 'Xe, thời gian và trạng thái bán vé',
  }

  const formSectionDone = {
    route: Boolean(
      tripForm.departureProvinceId &&
      tripForm.departureLocationId &&
      tripForm.arrivalProvinceId &&
      tripForm.arrivalLocationId,
    ),
    pickup: Boolean(tripForm.departureLocationId),
    dropoff: Boolean(tripForm.arrivalLocationId),
    operation: Boolean(tripForm.bus && tripForm.departureTime && tripForm.expectedArrivalTime),
  }

  const renderFormSectionHeader = (number, key, title, subtitle) => (
    <button
      className="admin-trip-v2-accordion__header"
      onClick={() => toggleFormSection(key)}
      type="button"
    >
      <span className={`admin-trip-v2-step-number ${formSectionDone[key] ? 'is-done' : ''}`}>
        {formSectionDone[key] ? '✓' : number}
      </span>
      <span className="admin-trip-v2-accordion__heading">
        <strong>{number}. {title}</strong>
        <small>{formSectionSummary[key] || subtitle}</small>
      </span>
      <span className={`admin-trip-v2-chevron ${formSections[key] ? 'is-open' : ''}`}>⌄</span>
    </button>
  )

  const renderTripFormPage = () => (
    <>
      <AdminPageHeader
        title={pageMode === 'edit' ? 'Sửa chuyến xe' : 'Thêm chuyến xe'}
        description=""
      />

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="admin-trip-compact-form" onSubmit={submitTrip}>
        <section className="admin-trip-compact-panel admin-trip-compact-operation">
          <div className="admin-trip-compact-panel__title">
            <strong>Thông tin chuyến xe</strong>
          </div>

          <div className="admin-trip-compact-operation-grid">
            <label className="admin-field">
              <span>Xe</span>
              <select
                className="form-select"
                name="bus"
                onChange={changeTripField}
                required
                value={tripForm.bus}
              >
                <option value="">Chọn xe đang hoạt động</option>
                {buses
                  .filter(
                    (bus) =>
                      bus.status === 'ACTIVE' ||
                      bus.id === (editingTrip?.bus?.id ?? editingTrip?.busId),
                  )
                  .map((bus) => (
                    <option key={bus.id} value={bus.id}>
                      {getBusTypeLabel(bus.busType)} – {formatLicensePlate(bus.licensePlate)}
                    </option>
                  ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Khởi hành</span>
              <input
                className="form-control"
                name="departureTime"
                onChange={changeTripField}
                required
                type="datetime-local"
                value={tripForm.departureTime}
              />
            </label>

            <label className="admin-field">
              <span>Dự kiến đến</span>
              <input
                className="form-control"
                name="expectedArrivalTime"
                onChange={changeTripField}
                required
                type="datetime-local"
                value={tripForm.expectedArrivalTime}
              />
            </label>

            <label className="admin-field">
              <span>Trạng thái bán vé</span>
              {pageMode === 'edit' ? (
                <input
                  className="form-control"
                  readOnly
                  value={TRIP_STATUS_LABELS[editingTrip?.status] || 'Không xác định'}
                />
              ) : (
                <select
                  className="form-select"
                  name="status"
                  onChange={changeTripField}
                  value={tripForm.status}
                >
                  <option value="OPEN">Đang mở bán</option>
                  <option value="CLOSED">Đã đóng đặt vé</option>
                </select>
              )}
            </label>

            {isRoomBusType(selectedTripBus?.busType) ? (
              <>
                <label className="admin-field">
                  <span>Giá phòng đơn</span>
                  <input
                    className="form-control"
                    min="0"
                    name="singleRoomPrice"
                    onChange={changeTripField}
                    required
                    step="1000"
                    type="number"
                    value={tripForm.singleRoomPrice}
                  />
                </label>
                <label className="admin-field">
                  <span>Giá phòng đôi</span>
                  <input
                    className="form-control"
                    min="0"
                    name="doubleRoomPrice"
                    onChange={changeTripField}
                    required
                    step="1000"
                    type="number"
                    value={tripForm.doubleRoomPrice}
                  />
                </label>
              </>
            ) : (
              <label className="admin-field">
                <span>Giá vé</span>
                <input
                  className="form-control"
                  min="0"
                  name="ticketPrice"
                  onChange={changeTripField}
                  required
                  step="1000"
                  type="number"
                  value={tripForm.ticketPrice}
                />
              </label>
            )}
          </div>
        </section>

        <div className="admin-trip-compact-service-grid">
          <section className="admin-trip-compact-service admin-trip-compact-service--pickup">
            <div className="admin-trip-compact-service__title">
              <strong>● Cấu hình điểm đón</strong>
            </div>

            <div className="admin-trip-compact-route-row">
              <label className="admin-field">
                <span>Tỉnh/Thành đi</span>
                <select
                  className="form-select"
                  name="departureProvinceId"
                  onChange={changeTripField}
                  required
                  value={tripForm.departureProvinceId}
                >
                  <option value="">Chọn tỉnh/thành</option>
                  {activeProvinces
                    .filter((province) => province.id !== tripForm.arrivalProvinceId)
                    .map((province) => (
                      <option key={province.id} value={province.id}>
                        {province.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Địa điểm chính</span>
                <select
                  className="form-select"
                  disabled={!tripForm.departureProvinceId}
                  name="departureLocationId"
                  onChange={changeTripField}
                  required
                  value={tripForm.departureLocationId}
                >
                  <option value="">Chọn địa điểm</option>
                  {departureLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-trip-compact-section">
              <strong className="admin-trip-compact-section__label">1. Điểm đón chính</strong>
              <div className="admin-trip-compact-choice-grid">
                <label
                  className={
                    serviceConfig.primaryPickupMode === 'DonTaiBenXe'
                      ? 'is-selected'
                      : ''
                  }
                >
                  <input
                    checked={serviceConfig.primaryPickupMode === 'DonTaiBenXe'}
                    name="primaryPickupMode"
                    onChange={() =>
                      setServiceSetting('primaryPickupMode', 'DonTaiBenXe')
                    }
                    type="radio"
                  />
                  <strong>Đón trực tiếp tại bến xe trung tâm</strong>
                </label>

                <label
                  className={
                    serviceConfig.primaryPickupMode === 'TaiVanPhong'
                      ? 'is-selected'
                      : ''
                  }
                >
                  <input
                    checked={serviceConfig.primaryPickupMode === 'TaiVanPhong'}
                    name="primaryPickupMode"
                    onChange={() =>
                      setServiceSetting('primaryPickupMode', 'TaiVanPhong')
                    }
                    type="radio"
                  />
                  <strong>Tập trung tại văn phòng nhà xe</strong>
                </label>
              </div>
            </div>

            <div className="admin-trip-compact-section admin-trip-compact-toggle-section">
              <strong className="admin-trip-compact-section__label">
                2. Xe trung chuyển đón khách
              </strong>
              <label className="admin-trip-compact-switch-line">
                <input
                  checked={serviceConfig.allowPickupTransfer}
                  onChange={(event) =>
                    setServiceSetting('allowPickupTransfer', event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Cho phép xe trung chuyển đón khách</span>
              </label>
            </div>

            <div className="admin-trip-compact-section">
              <div className="admin-trip-compact-section__head">
                <strong className="admin-trip-compact-section__label">
                  3. Đón khách tại điểm hẹn
                </strong>
                {serviceConfig.allowPickupMeetingPoint && (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    disabled={!tripForm.departureLocationId}
                    onClick={addMeetingPoint}
                    type="button"
                  >
                    + Thêm điểm hẹn
                  </button>
                )}
              </div>

              <label className="admin-trip-compact-switch-line">
                <input
                  checked={serviceConfig.allowPickupMeetingPoint}
                  onChange={(event) =>
                    setServiceSetting(
                      'allowPickupMeetingPoint',
                      event.target.checked,
                    )
                  }
                  type="checkbox"
                />
                <span>Cho phép đón khách tại điểm hẹn</span>
              </label>

              {serviceConfig.allowPickupMeetingPoint &&
                serviceConfig.meetingPoints.length > 0 && (
                  <div className="admin-trip-compact-point-list">
                    {serviceConfig.meetingPoints.map((point, index) => (
                      <div
                        className="admin-trip-compact-point-row"
                        key={point.clientId}
                      >
                        <label>
                          <span>Điểm hẹn</span>
                          <select
                            className="form-select"
                            onChange={(event) =>
                              updateServiceRow(
                                'meetingPoints',
                                index,
                                'locationId',
                                event.target.value,
                              )
                            }
                            value={point.locationId}
                          >
                            <option value="">Chọn địa điểm</option>
                            {availableLocationsForRow(
                              pickupMeetingCatalog,
                              serviceConfig.meetingPoints,
                              index,
                            ).map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Giờ đón</span>
                          <input
                            className="form-control"
                            onChange={(event) =>
                              updateServiceRow(
                                'meetingPoints',
                                index,
                                'estimatedTime',
                                event.target.value,
                              )
                            }
                            type="time"
                            value={point.estimatedTime}
                          />
                        </label>

                        <label>
                          <span>Thứ tự</span>
                          <input
                            className="form-control"
                            min="0"
                            onChange={(event) =>
                              updateServiceRow(
                                'meetingPoints',
                                index,
                                'sortOrder',
                                event.target.value,
                              )
                            }
                            type="number"
                            value={point.sortOrder}
                          />
                        </label>

                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() =>
                            removeServiceRow('meetingPoints', index)
                          }
                          type="button"
                        >
                          Bỏ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </section>

          <section className="admin-trip-compact-service admin-trip-compact-service--dropoff">
            <div className="admin-trip-compact-service__title">
              <strong>● Cấu hình điểm trả</strong>
            </div>

            <div className="admin-trip-compact-route-row">
              <label className="admin-field">
                <span>Tỉnh/Thành đến</span>
                <select
                  className="form-select"
                  name="arrivalProvinceId"
                  onChange={changeTripField}
                  required
                  value={tripForm.arrivalProvinceId}
                >
                  <option value="">Chọn tỉnh/thành</option>
                  {activeProvinces
                    .filter(
                      (province) => province.id !== tripForm.departureProvinceId,
                    )
                    .map((province) => (
                      <option key={province.id} value={province.id}>
                        {province.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Địa điểm chính</span>
                <select
                  className="form-select"
                  disabled={!tripForm.arrivalProvinceId}
                  name="arrivalLocationId"
                  onChange={changeTripField}
                  required
                  value={tripForm.arrivalLocationId}
                >
                  <option value="">Chọn địa điểm</option>
                  {arrivalLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-trip-compact-section">
              <strong className="admin-trip-compact-section__label">1. Điểm trả chính</strong>
              <div className="admin-trip-compact-choice-grid">
                <label
                  className={
                    serviceConfig.primaryDropoffMode === 'TraTaiBenXe'
                      ? 'is-selected'
                      : ''
                  }
                >
                  <input
                    checked={serviceConfig.primaryDropoffMode === 'TraTaiBenXe'}
                    name="primaryDropoffMode"
                    onChange={() =>
                      setServiceSetting('primaryDropoffMode', 'TraTaiBenXe')
                    }
                    type="radio"
                  />
                  <strong>Trả khách tại bến xe trung tâm</strong>
                </label>

                <label
                  className={
                    serviceConfig.primaryDropoffMode === 'TraTaiVanPhong'
                      ? 'is-selected'
                      : ''
                  }
                >
                  <input
                    checked={serviceConfig.primaryDropoffMode === 'TraTaiVanPhong'}
                    name="primaryDropoffMode"
                    onChange={() =>
                      setServiceSetting('primaryDropoffMode', 'TraTaiVanPhong')
                    }
                    type="radio"
                  />
                  <strong>Trả khách tại văn phòng nhà xe</strong>
                </label>
              </div>
            </div>

            <div className="admin-trip-compact-section admin-trip-compact-toggle-section">
              <strong className="admin-trip-compact-section__label">
                2. Xe trung chuyển trả tận nơi
              </strong>
              <label className="admin-trip-compact-switch-line">
                <input
                  checked={serviceConfig.allowDropoffTransfer}
                  onChange={(event) =>
                    setServiceSetting('allowDropoffTransfer', event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Cho phép xe trung chuyển trả tận nơi</span>
              </label>
            </div>

            <div className="admin-trip-compact-section">
              <div className="admin-trip-compact-section__head">
                <strong className="admin-trip-compact-section__label">
                  3. Trả khách tại điểm dừng
                </strong>
                {serviceConfig.allowDropoffStop && (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    disabled={!tripForm.arrivalLocationId}
                    onClick={addDropoffStop}
                    type="button"
                  >
                    + Thêm điểm dừng
                  </button>
                )}
              </div>

              <label className="admin-trip-compact-switch-line">
                <input
                  checked={serviceConfig.allowDropoffStop}
                  onChange={(event) =>
                    setServiceSetting('allowDropoffStop', event.target.checked)
                  }
                  type="checkbox"
                />
                <span>Cho phép trả khách tại điểm dừng</span>
              </label>

              {serviceConfig.allowDropoffStop &&
                serviceConfig.dropoffStops.length > 0 && (
                  <div className="admin-trip-compact-point-list">
                    {serviceConfig.dropoffStops.map((point, index) => (
                      <div
                        className="admin-trip-compact-point-row"
                        key={point.clientId}
                      >
                        <label>
                          <span>Điểm dừng</span>
                          <select
                            className="form-select"
                            onChange={(event) =>
                              updateServiceRow(
                                'dropoffStops',
                                index,
                                'locationId',
                                event.target.value,
                              )
                            }
                            value={point.locationId}
                          >
                            <option value="">Chọn địa điểm</option>
                            {availableLocationsForRow(
                              dropoffStopCatalog,
                              serviceConfig.dropoffStops,
                              index,
                            ).map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span>Giờ trả</span>
                          <input
                            className="form-control"
                            onChange={(event) =>
                              updateServiceRow(
                                'dropoffStops',
                                index,
                                'estimatedTime',
                                event.target.value,
                              )
                            }
                            type="time"
                            value={point.estimatedTime}
                          />
                        </label>

                        <label>
                          <span>Thứ tự</span>
                          <input
                            className="form-control"
                            min="0"
                            onChange={(event) =>
                              updateServiceRow(
                                'dropoffStops',
                                index,
                                'sortOrder',
                                event.target.value,
                              )
                            }
                            type="number"
                            value={point.sortOrder}
                          />
                        </label>

                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() =>
                            removeServiceRow('dropoffStops', index)
                          }
                          type="button"
                        >
                          Bỏ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </section>
        </div>

        <div className="admin-trip-compact-actions">
          <button
            className="btn btn-primary"
            disabled={submittingTrip}
            type="submit"
          >
            {submittingTrip
              ? 'Đang lưu...'
              : pageMode === 'edit'
                ? 'Lưu thay đổi'
                : 'Lưu chuyến xe'}
          </button>

          <button
            className="btn btn-outline-secondary"
            disabled={submittingTrip}
            onClick={resetTripForm}
            type="button"
          >
            Hủy
          </button>
        </div>
      </form>
    </>
  )

  if (error && !trips.length) {
    return <ErrorState message={error} onRetry={() => load(tripPage, appliedTripFilters)} />
  }
  if (loading && !trips.length) return <LoadingState />
  if (isFormPage && pageMode === 'edit' && formRecordLoading) return <LoadingState />
  if (isFormPage && pageMode === 'edit' && error && !editingTrip) {
    return <ErrorState message={error} onRetry={() => { editLoadRef.current = ''; window.location.reload() }} />
  }
  if (isFormPage) return renderTripFormPage()

  return (
    <>
      <AdminPageHeader
        title="Quản lý chuyến xe và tuyến đường"
        description=""
      />

      {error && <div className="alert alert-danger">{error}</div>}


      <section className="admin-panel admin-trip-mvc-panel">
        <div className="admin-trip-mvc-heading">
          <div>
            <h2>Danh sách chuyến xe</h2>
            <p>Tổng cộng {tripPagination?.total ?? trips.length} chuyến xe</p>
          </div>
          <div className="admin-trip-mvc-heading__actions">
            <button
              className={`btn btn-sm ${showTripFilters ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setShowTripFilters((current) => !current)}
              type="button"
            >
              ⚲ Bộ lọc
            </button>
            {canCreateTrips && (
              <Link className="btn btn-sm btn-primary" to="/admin/chuyen-xe/them">
                ⊕ Thêm chuyến mới
              </Link>
            )}
          </div>
        </div>

        {showTripFilters && (
          <form className="admin-trip-mvc-filter" onSubmit={submitTripFilters}>
            <label>
              <span>Trạng thái</span>
              <select
                className="form-select"
                value={tripFilters.status}
                onChange={(event) =>
                  setTripFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(TRIP_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Ngày đi</span>
              <input
                className="form-control"
                type="date"
                value={tripFilters.departureDate}
                onChange={(event) =>
                  setTripFilters((current) => ({ ...current, departureDate: event.target.value }))
                }
              />
            </label>
            <div className="admin-trip-mvc-filter__actions">
              <button className="btn btn-sm btn-primary" type="submit">Lọc</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={clearTripFilters} type="button">
                Xóa lọc
              </button>
            </div>
          </form>
        )}

        {trips.length === 0 ? (
          <EmptyState message="Chưa có chuyến xe phù hợp." />
        ) : (
          <div className="admin-table-wrap admin-trip-mvc-table-wrap">
            <table className="admin-table admin-trip-mvc-table">
              <thead>
                <tr>
                  <th>Mã chuyến</th>
                  <th>Xe</th>
                  <th>Tuyến đường</th>
                  <th>Ngày đi</th>
                  <th>Giờ đi</th>
                  <th>Trạng thái</th>
                  <th>Giá vé</th>
                  <th>Ghế còn trống</th>
                  <th>Đặt vé</th>
                  <th>Sơ đồ ghế</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => {
                  const effectiveStatus = getEffectiveTripStatus(trip)
                  const hasDeparted = new Date(trip.departureTime) <= new Date()
                  const isProcessing = processingTripId === trip.id
                  const canManageBeforeDeparture =
                    !hasDeparted && !['COMPLETED', 'CANCELLED'].includes(effectiveStatus)
                  const canBook = canManageBeforeDeparture && trip.status === 'OPEN'
                  const canComplete = canEditTrips && hasDeparted && effectiveStatus === 'DEPARTED'
                  const departure = trip.departureLocation || trip.route?.departureLocation
                  const arrival = trip.arrivalLocation || trip.route?.arrivalLocation
                  const available = Number(trip.seatStats?.available ?? 0)
                  const booked = Number(trip.seatStats?.booked ?? 0)
                  const held = Number(trip.seatStats?.held ?? 0)
                  const capacity = getTripCapacity(trip)
                  const occupied = Math.max(0, capacity - available)
                  const occupiedPercent = capacity > 0
                    ? Math.min(100, Math.round((occupied / capacity) * 100))
                    : 0
                  const dayBadge = getJourneyDayBadge(trip, effectiveStatus)

                  return (
                    <tr key={trip.id}>
                      <td className="admin-trip-mvc-code">
                        <strong>#{String(trip.id || '').split('-')[0].toUpperCase()}</strong>
                      </td>
                      <td className="admin-trip-mvc-bus">
                        <strong>{formatLicensePlate(trip.bus?.licensePlate) || '—'}</strong>
                        <small>{trip.bus?.busType ? getBusTypeLabel(trip.bus.busType) : 'Chưa cập nhật'}</small>
                      </td>
                      <td className="admin-trip-mvc-route">
                        <span className="is-departure">● {departure?.name || 'Chưa cập nhật'}</span>
                        <span className="is-arrival">● {arrival?.name || 'Chưa cập nhật'}</span>
                      </td>
                      <td className="admin-trip-mvc-date">
                        <strong>{formatAdminDate(trip.departureTime)}</strong>
                        {dayBadge && (
                          <span className={`admin-trip-day-badge ${dayBadge.className}`}>{dayBadge.label}</span>
                        )}
                      </td>
                      <td><strong>{formatAdminTime(trip.departureTime)}</strong></td>
                      <td>
                        <span className={getTripStatusClass(effectiveStatus)}>
                          {TRIP_STATUS_LABELS[effectiveStatus] || 'Không xác định'}
                        </span>
                      </td>
                      <td className="admin-trip-mvc-price">
                        {isRoomBusType(trip.bus?.busType) ? (
                          <>
                            <strong>Đơn: {formatCurrency(trip.singleRoomPrice ?? 0)}</strong>
                            <strong>Đôi: {formatCurrency(trip.doubleRoomPrice ?? 0)}</strong>
                          </>
                        ) : (
                          <strong>{formatCurrency(trip.ticketPrice ?? 0)}</strong>
                        )}
                      </td>
                      <td className="admin-trip-mvc-seats">
                        <div className="admin-trip-seat-line">
                          <strong>{available} / {capacity || '—'}</strong>
                          <span>còn trống</span>
                        </div>
                        <div className="admin-trip-seat-progress" aria-hidden="true">
                          <span style={{ width: `${occupiedPercent}%` }} />
                        </div>
                        <small>Đã đặt {booked} ghế{held > 0 ? ` · Giữ ${held}` : ''}</small>
                      </td>
                      <td>
                        <div className="admin-trip-mvc-actions admin-trip-mvc-actions--booking">
                          {canBook ? (
                            <>
                              <Link className="is-counter" to={`/admin/dat-ve-tai-quay/${trip.id}`}>▣ Tại quầy</Link>
                              <Link className="is-hotline" to={`/admin/dat-ve-hotline/${trip.id}`}>☎ Hotline</Link>
                            </>
                          ) : (
                            <span className="admin-trip-disabled-action">Không thể đặt</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-trip-mvc-actions admin-trip-mvc-actions--seat">
                          <Link to={`/admin/chuyen-xe/${trip.id}/so-do-ghe`}>▣ Xem ghế</Link>
                          <Link to={`/admin/chuyen-xe/${trip.id}/hanh-khach`}>♣ Hành khách</Link>
                        </div>
                      </td>
                      <td>
                        <div className="admin-trip-mvc-actions admin-trip-mvc-actions--management">
                          {canManageBeforeDeparture && canEditTrips && (
                            <Link className={isProcessing ? 'is-disabled' : ''} to={`/admin/chuyen-xe/${trip.id}/sua`}>✎ Sửa</Link>
                          )}
                          {canManageBeforeDeparture && canEditTrips && trip.status === 'OPEN' && (
                            <button disabled={isProcessing} onClick={() => updateStatus(trip, 'CLOSED')} type="button">⊘ Ngừng bán</button>
                          )}
                          {canManageBeforeDeparture && canEditTrips && trip.status === 'CLOSED' && (
                            <button disabled={isProcessing} onClick={() => updateStatus(trip, 'OPEN')} type="button">↻ Mở bán</button>
                          )}
                          {canDeleteTrips && canManageBeforeDeparture && (
                            <Link className="is-danger" to={`/admin/chuyen-xe/${trip.id}/huy`}>× Hủy</Link>
                          )}
                          {canComplete && (
                            <button className="is-success" disabled={isProcessing} onClick={() => completeTrip(trip)} type="button">
                              {isProcessing ? 'Đang xử lý...' : '⚑ Hoàn thành'}
                            </button>
                          )}
                          {effectiveStatus === 'COMPLETED' && <span className="admin-trip-locked">Đã khóa xử lý</span>}
                          {effectiveStatus === 'CANCELLED' && <span className="admin-trip-locked">Đã hủy</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {(tripPagination?.totalPages ?? 1) > 1 && (
          <div className="admin-trip-mvc-pagination">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={tripPage <= 1 || loading}
              onClick={() => setTripPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Trang trước
            </button>
            <strong>Trang {tripPagination?.page ?? tripPage}/{tripPagination?.totalPages ?? 1}</strong>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={tripPage >= (tripPagination?.totalPages ?? 1) || loading}
              onClick={() => setTripPage((current) => current + 1)}
              type="button"
            >
              Trang sau
            </button>
          </div>
        )}
      </section>

      {canViewRoutes && (
        <AdminRoutesSummaryPage
          embedded
          refreshKey={`${tripPagination?.total ?? 0}:${trips
            .map((trip) => `${trip.id}:${trip.status}:${trip.departureLocation?.id || ''}:${trip.arrivalLocation?.id || ''}`)
            .join('|')}`}
        />
      )}

    </>
  )
}

export default AdminTripsRoutesPage

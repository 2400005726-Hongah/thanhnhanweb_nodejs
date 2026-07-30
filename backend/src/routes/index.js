import { Router } from 'express'

import authRoutes from './auth.routes.js'
import adminRoutes from './admin.routes.js'
import bookingRoutes from './booking.routes.js'
import busRoutes from './bus.routes.js'
import healthRoutes from './health.routes.js'
import locationRoutes from './location.routes.js'
import newsRoutes from './news.routes.js'
import publicRoutes from './public.routes.js'
import routeRoutes from './route.routes.js'
import tripRoutes from './trip.routes.js'

const router = Router()

router.use(healthRoutes)
router.use('/admin', adminRoutes)
router.use('/admin/news', newsRoutes)
router.use('/auth', authRoutes)
router.use('/bookings', bookingRoutes)
router.use('/locations', locationRoutes)
router.use('/public', publicRoutes)
router.use('/routes', routeRoutes)
router.use('/buses', busRoutes)
router.use('/trips', tripRoutes)

export default router

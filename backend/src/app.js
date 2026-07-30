import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import env from './config/env.js'
import errorHandler from './middlewares/error.middleware.js'
import notFoundHandler from './middlewares/notFound.middleware.js'
import apiRoutes from './routes/index.js'

const app = express()

const localDevelopmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/

const isAllowedOrigin = (origin) =>
  !origin ||
  origin === env.clientUrl ||
  (env.nodeEnv !== 'production' && localDevelopmentOrigin.test(origin))

app.disable('x-powered-by')

app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin))
    },
    credentials: true,
  }),
)

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/v1', apiRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
export { isAllowedOrigin }

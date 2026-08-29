const getTripJourneyEndpoints = (trip = {}) => {
  const departureLocation =
    trip.departureLocation || trip.route?.departureLocation || null
  const arrivalLocation =
    trip.arrivalLocation || trip.route?.arrivalLocation || null

  return { departureLocation, arrivalLocation }
}

const getTripJourneyName = (trip = {}) => {
  const { departureLocation, arrivalLocation } = getTripJourneyEndpoints(trip)
  if (departureLocation?.name && arrivalLocation?.name) {
    return `${departureLocation.name} → ${arrivalLocation.name}`
  }
  return trip.route?.routeName || 'Chưa xác định'
}

const buildTripRouteSnapshot = (trip = {}) => {
  const { departureLocation, arrivalLocation } = getTripJourneyEndpoints(trip)
  return {
    id: trip.route?.id || null,
    routeName: getTripJourneyName(trip),
    departureLocation,
    arrivalLocation,
    distanceKm: trip.route?.distanceKm ?? null,
    estimatedDurationMinutes: trip.route?.estimatedDurationMinutes ?? null,
    legacy: Boolean(trip.route?.id),
  }
}

export {
  buildTripRouteSnapshot,
  getTripJourneyEndpoints,
  getTripJourneyName,
}

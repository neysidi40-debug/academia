export function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isAppointmentDateAvailable(date) {
  return date.getDay() !== 0;
}

export function getAppointmentTimes(date) {
  if (!isAppointmentDateAvailable(date)) return [];
  return Array.from({ length: 20 }, (_, index) => {
    const minutes = 8 * 60 + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
}

export function isAppointmentTimeAvailable(appointments, date, time) {
  return getAppointmentTimes(date).includes(time)
    && !appointments.some((appointment) => (
      appointment.date === toDateKey(date)
      && appointment.time === time
      && appointment.status !== "Cancelado"
    ));
}

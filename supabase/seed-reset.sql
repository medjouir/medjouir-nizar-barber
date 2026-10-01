-- Removes the sample data created by seed.sql (clients with +2126000000xx
-- phones, their appointments, and "[seed]" exceptions). Keeps Nizar's barber
-- profile, services and working hours.

delete from public.appointments a using public.clients c
  where a.client_id = c.id and c.phone like '+2126000000%';
delete from public.clients where phone like '+2126000000%';
delete from public.schedule_exceptions where reason like '[seed]%';

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.has_role(auth.uid(),'admin'));

DROP POLICY "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'));

DROP POLICY "services admin write" ON public.services;
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY "admin manages workers" ON public.workers;
CREATE POLICY "admin manages workers" ON public.workers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY "customer reads own bookings" ON public.bookings;
CREATE POLICY "customer reads own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
     OR private.has_role(auth.uid(),'admin')
     OR worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid()));

DROP POLICY "admin manages bookings" ON public.bookings;
CREATE POLICY "admin manages bookings" ON public.bookings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY "admin edits weights" ON public.allocation_weights;
CREATE POLICY "admin edits weights" ON public.allocation_weights FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP FUNCTION public.has_role(uuid, public.app_role);
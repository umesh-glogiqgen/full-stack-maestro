
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','worker','customer');
CREATE TYPE public.availability_status AS ENUM ('available','busy','unavailable');
CREATE TYPE public.verification_status AS ENUM ('pending','verified','rejected','suspended');
CREATE TYPE public.booking_status AS ENUM ('pending','accepted','in_progress','completed','cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid','paid');

-- UTIL
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  city TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- SERVICES
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'wrench',
  description TEXT NOT NULL DEFAULT '',
  base_price NUMERIC NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read" ON public.services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- WORKERS
CREATE TABLE public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  photo_url TEXT,
  primary_skill TEXT NOT NULL,
  additional_skills TEXT[] NOT NULL DEFAULT '{}',
  experience_years INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  latitude NUMERIC NOT NULL DEFAULT 16.815,
  longitude NUMERIC NOT NULL DEFAULT 81.523,
  service_radius_km INTEGER NOT NULL DEFAULT 10,
  working_hours TEXT NOT NULL DEFAULT '09:00 - 18:00',
  languages TEXT[] NOT NULL DEFAULT '{Telugu,English}',
  bio TEXT NOT NULL DEFAULT '',
  hourly_rate NUMERIC NOT NULL DEFAULT 300,
  availability public.availability_status NOT NULL DEFAULT 'available',
  verification public.verification_status NOT NULL DEFAULT 'pending',
  rating NUMERIC NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  active_jobs INTEGER NOT NULL DEFAULT 0,
  pending_jobs INTEGER NOT NULL DEFAULT 0,
  recent_jobs INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT SELECT ON public.workers TO anon;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER workers_updated BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "workers readable" ON public.workers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "worker updates own" ON public.workers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "worker inserts own" ON public.workers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin manages workers" ON public.workers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code TEXT NOT NULL UNIQUE DEFAULT ('BK-' || upper(substr(md5(random()::text),1,6))),
  customer_id UUID,
  customer_name TEXT NOT NULL DEFAULT 'Customer',
  customer_phone TEXT,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  status public.booking_status NOT NULL DEFAULT 'pending',
  payment public.payment_status NOT NULL DEFAULT 'unpaid',
  fair_score NUMERIC,
  score_breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "customer reads own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
     OR public.has_role(auth.uid(),'admin')
     OR worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid()));
CREATE POLICY "customer creates bookings" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "customer updates own bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "worker updates assigned bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid()))
  WITH CHECK (worker_id IN (SELECT id FROM public.workers WHERE user_id = auth.uid()));
CREATE POLICY "admin manages bookings" ON public.bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- REVIEWS
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  customer_id UUID,
  customer_name TEXT NOT NULL DEFAULT 'Customer',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews readable" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "customer writes review" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- FAVORITES
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, worker_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites" ON public.favorites FOR ALL TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

-- ALLOCATION WEIGHTS
CREATE TABLE public.allocation_weights (
  id INTEGER PRIMARY KEY DEFAULT 1,
  skill INTEGER NOT NULL DEFAULT 30,
  distance INTEGER NOT NULL DEFAULT 20,
  availability INTEGER NOT NULL DEFAULT 15,
  workload INTEGER NOT NULL DEFAULT 15,
  recent_jobs INTEGER NOT NULL DEFAULT 10,
  rating INTEGER NOT NULL DEFAULT 5,
  experience INTEGER NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.allocation_weights TO anon, authenticated;
GRANT INSERT, UPDATE ON public.allocation_weights TO authenticated;
GRANT ALL ON public.allocation_weights TO service_role;
ALTER TABLE public.allocation_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weights readable" ON public.allocation_weights FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin edits weights" ON public.allocation_weights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.allocation_weights (id) VALUES (1);

-- NEW USER HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
BEGIN
  _role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role',''), 'customer')::public.app_role;

  INSERT INTO public.profiles (id, full_name, email, phone, city)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name',''),
          NEW.email,
          NEW.raw_user_meta_data->>'phone',
          NEW.raw_user_meta_data->>'city')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  IF _role = 'worker' THEN
    INSERT INTO public.workers (user_id, full_name, email, phone, primary_skill, experience_years, location, bio)
    VALUES (NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name','New Worker'),
            NEW.email,
            NEW.raw_user_meta_data->>'phone',
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'primary_skill',''),'Electrician'),
            COALESCE((NEW.raw_user_meta_data->>'experience_years')::int, 0),
            COALESCE(NEW.raw_user_meta_data->>'city','Tadepalligudem'),
            '')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DEMO SERVICES
INSERT INTO public.services (name, slug, icon, description, base_price) VALUES
('Electrician','electrician','zap','Wiring, fans, switchboards and electrical repairs',400),
('Plumber','plumber','droplets','Leaks, taps, pipelines and bathroom fittings',350),
('Carpenter','carpenter','hammer','Furniture repair, doors, windows and woodwork',500),
('Painter','painter','paintbrush','Interior and exterior painting work',450),
('Cleaner','cleaner','sparkles','Deep home cleaning and housekeeping',300),
('AC Repair','ac-repair','wind','AC servicing, gas filling and installation',600),
('Appliance Repair','appliance-repair','plug','Fridge, washing machine and microwave repair',550),
('Gardener','gardener','leaf','Lawn care, plant maintenance and landscaping',300),
('Pest Control','pest-control','bug','Cockroach, termite and mosquito treatment',700),
('Home Maintenance','home-maintenance','wrench','General handyman and household repairs',400);

-- DEMO WORKERS
INSERT INTO public.workers (full_name, phone, email, primary_skill, additional_skills, experience_years, location, latitude, longitude, service_radius_km, bio, hourly_rate, availability, verification, rating, rating_count, completed_jobs, active_jobs, pending_jobs, recent_jobs, total_earnings) VALUES
('Ravi Kumar','9876543210','ravi.kumar@example.com','Electrician','{"Appliance Repair","Home Maintenance"}',8,'Tadepalligudem',16.8150,81.5230,12,'Experienced electrician handling home and shop wiring.',450,'available','verified',4.8,64,132,1,2,4,148000),
('Suresh Babu','9876543211','suresh.babu@example.com','Plumber','{"Home Maintenance"}',6,'Tadepalligudem',16.8210,81.5290,10,'Quick plumbing fixes and bathroom fittings.',380,'available','verified',4.5,41,88,2,1,6,72000),
('Arun Prasad','9876543212','arun.prasad@example.com','Electrician','{"AC Repair"}',4,'Nidadavolu',16.9080,81.6700,15,'Electrical and AC work with same-day service.',400,'busy','verified',4.2,28,54,3,2,9,49000),
('Lakshmi Devi','9876543213','lakshmi.devi@example.com','Cleaner','{"Pest Control"}',5,'Tadepalligudem',16.8100,81.5180,8,'Deep cleaning specialist for homes and offices.',300,'available','verified',4.9,77,190,0,1,3,110000),
('Venkatesh Rao','9876543214','venkatesh.rao@example.com','Carpenter','{"Home Maintenance"}',12,'Bhimavaram',16.5449,81.5212,20,'Custom furniture and door repairs.',520,'available','verified',4.6,52,140,1,0,2,168000),
('Naveen Chandra','9876543215','naveen.chandra@example.com','Painter','{}',3,'Tadepalligudem',16.8190,81.5310,10,'Neat interior painting with quality materials.',420,'available','verified',4.0,19,32,0,3,7,26000),
('Kumar Swamy','9876543216','kumar.swamy@example.com','AC Repair','{"Appliance Repair","Electrician"}',9,'Tadepalligudem',16.8085,81.5265,14,'AC servicing, gas refill and installation.',600,'available','verified',4.7,58,121,2,1,5,145000),
('Prasad Reddy','9876543217','prasad.reddy@example.com','Appliance Repair','{"Electrician"}',7,'Tanuku',16.7550,81.6800,18,'Fridge and washing machine expert.',500,'busy','verified',4.3,33,76,4,2,10,68000),
('Srinivas Rao','9876543218','srinivas.rao@example.com','Gardener','{}',10,'Tadepalligudem',16.8225,81.5150,9,'Lawn maintenance and garden landscaping.',320,'available','verified',4.4,24,61,0,0,1,39000),
('Anitha Kumari','9876543219','anitha.kumari@example.com','Cleaner','{"Home Maintenance"}',2,'Nidadavolu',16.9100,81.6650,10,'Reliable housekeeping and kitchen cleaning.',280,'available','verified',4.1,12,21,1,1,2,14000),
('Mahesh Varma','9876543220','mahesh.varma@example.com','Pest Control','{"Cleaner"}',6,'Bhimavaram',16.5400,81.5300,25,'Termite and cockroach treatment with warranty.',700,'available','verified',4.5,30,70,1,0,3,84000),
('Rajesh Naidu','9876543221','rajesh.naidu@example.com','Plumber','{"Home Maintenance"}',11,'Tadepalligudem',16.8130,81.5340,12,'Borewell, motor and pipeline works.',400,'unavailable','verified',4.6,45,105,0,0,0,96000),
('Deepak Sharma','9876543222','deepak.sharma@example.com','Carpenter','{"Painter"}',5,'Tanuku',16.7500,81.6850,15,'Modular furniture and polish work.',480,'available','verified',3.9,17,38,2,2,8,34000),
('Sai Krishna','9876543223','sai.krishna@example.com','Electrician','{}',2,'Tadepalligudem',16.8175,81.5205,8,'Young electrician available for quick jobs.',300,'available','pending',0,0,0,0,0,0,0),
('Bhavani Prasad','9876543224','bhavani.prasad@example.com','Painter','{"Home Maintenance"}',14,'Bhimavaram',16.5480,81.5250,22,'Exterior painting and waterproofing.',550,'available','verified',4.8,68,175,1,1,4,182000),
('Ganesh Yadav','9876543225','ganesh.yadav@example.com','Home Maintenance','{"Plumber","Carpenter"}',4,'Nidadavolu',16.9050,81.6720,12,'All-round handyman for household repairs.',350,'busy','pending',3.8,9,15,3,4,11,9000),
('Ramesh Chowdary','9876543226','ramesh.chowdary@example.com','Gardener','{"Cleaner"}',3,'Tanuku',16.7580,81.6750,10,'Garden setup and seasonal plant care.',300,'available','rejected',0,0,0,0,0,0,0),
('Kiran Kumar','9876543227','kiran.kumar@example.com','AC Repair','{}',6,'Bhimavaram',16.5430,81.5190,20,'Split and window AC service.',580,'available','suspended',3.5,11,26,0,0,0,15000);

-- DEMO BOOKINGS
INSERT INTO public.bookings (customer_name, customer_phone, worker_id, service_id, service_name, scheduled_date, scheduled_time, location, description, price, status, payment, fair_score, created_at)
SELECT c.name, c.phone, w.id, s.id, s.name, c.d, c.t, c.loc, c.descr, c.price, c.st::public.booking_status, c.pay::public.payment_status, c.score, now() - (c.age || ' days')::interval
FROM (VALUES
 ('Anil Varma','9000000001','Ravi Kumar','Electrician',CURRENT_DATE - 20,'10:00 AM','Main Road, Tadepalligudem','Fan not working',450,'completed','paid',92.1,20),
 ('Sneha Reddy','9000000002','Lakshmi Devi','Cleaner',CURRENT_DATE - 18,'09:00 AM','Gandhi Nagar, Tadepalligudem','Full house deep clean',900,'completed','paid',88.4,18),
 ('Kiran Babu','9000000003','Suresh Babu','Plumber',CURRENT_DATE - 15,'11:30 AM','Bus Stand Road, Tadepalligudem','Bathroom tap leaking',380,'completed','paid',85.2,15),
 ('Divya Sri','9000000004','Kumar Swamy','AC Repair',CURRENT_DATE - 12,'04:00 PM','NTR Circle, Tadepalligudem','AC gas refill',1200,'completed','paid',90.7,12),
 ('Ramu Naidu','9000000005','Venkatesh Rao','Carpenter',CURRENT_DATE - 10,'02:00 PM','Church Street, Bhimavaram','Door hinge repair',520,'completed','paid',87.0,10),
 ('Padma Latha','9000000006','Bhavani Prasad','Painter',CURRENT_DATE - 8,'08:30 AM','Market Road, Bhimavaram','Two bedrooms painting',5500,'completed','paid',91.3,8),
 ('Naga Raju','9000000007','Prasad Reddy','Appliance Repair',CURRENT_DATE - 6,'01:00 PM','Temple Street, Tanuku','Washing machine noise',600,'completed','unpaid',82.9,6),
 ('Sita Mahalakshmi','9000000008','Mahesh Varma','Pest Control',CURRENT_DATE - 5,'10:00 AM','College Road, Bhimavaram','Cockroach treatment',700,'in_progress','unpaid',84.5,5),
 ('Harish Kumar','9000000009','Arun Prasad','Electrician',CURRENT_DATE - 3,'03:00 PM','Rail Nagar, Nidadavolu','Switchboard replacement',400,'in_progress','unpaid',79.6,3),
 ('Vijaya Durga','9000000010','Ganesh Yadav','Home Maintenance',CURRENT_DATE - 2,'11:00 AM','Old Town, Nidadavolu','Multiple small repairs',700,'accepted','unpaid',73.4,2),
 ('Rakesh Varma','9000000011','Deepak Sharma','Carpenter',CURRENT_DATE + 1,'09:30 AM','Sivalayam Street, Tanuku','New shelf fitting',480,'accepted','unpaid',76.8,1),
 ('Meena Kumari','9000000012','Naveen Chandra','Painter',CURRENT_DATE + 2,'10:00 AM','Ashok Nagar, Tadepalligudem','Hall repainting',2200,'pending','unpaid',74.2,1),
 ('Suman Rao','9000000013','Ravi Kumar','Electrician',CURRENT_DATE + 2,'05:00 PM','Vinayaka Street, Tadepalligudem','Inverter installation',900,'pending','unpaid',92.1,1),
 ('Chaitanya','9000000014','Srinivas Rao','Gardener',CURRENT_DATE + 3,'07:00 AM','Green Park, Tadepalligudem','Lawn trimming',320,'pending','unpaid',80.1,1),
 ('Lavanya','9000000015','Anitha Kumari','Cleaner',CURRENT_DATE + 3,'12:00 PM','Sai Nagar, Nidadavolu','Kitchen cleaning',300,'pending','unpaid',71.9,1),
 ('Gopal Krishna','9000000016','Kumar Swamy','AC Repair',CURRENT_DATE + 4,'02:00 PM','Housing Board, Tadepalligudem','AC service x2',1100,'accepted','unpaid',90.7,1),
 ('Bhargav','9000000017','Suresh Babu','Plumber',CURRENT_DATE - 25,'10:00 AM','Fire Station Road, Tadepalligudem','Pipeline blockage',420,'completed','paid',85.2,25),
 ('Yamini','9000000018','Lakshmi Devi','Cleaner',CURRENT_DATE - 22,'09:00 AM','Balaji Nagar, Tadepalligudem','Sofa and carpet cleaning',650,'completed','paid',88.4,22),
 ('Tarun Teja','9000000019','Prasad Reddy','Appliance Repair',CURRENT_DATE - 4,'06:00 PM','Kakarapalli, Tanuku','Fridge not cooling',700,'cancelled','unpaid',82.9,4),
 ('Swetha','9000000020','Rajesh Naidu','Plumber',CURRENT_DATE - 30,'08:00 AM','Chinta Street, Tadepalligudem','Motor repair',600,'completed','paid',83.3,30),
 ('Praveen','9000000021','Venkatesh Rao','Carpenter',CURRENT_DATE - 28,'03:00 PM','JP Nagar, Bhimavaram','Window frame work',900,'completed','paid',87.0,28),
 ('Sailaja','9000000022','Bhavani Prasad','Painter',CURRENT_DATE + 5,'09:00 AM','RTC Complex, Bhimavaram','Exterior wall painting',7000,'pending','unpaid',91.3,1)
) AS c(name, phone, wname, sname, d, t, loc, descr, price, st, pay, score, age)
JOIN public.workers w ON w.full_name = c.wname
JOIN public.services s ON s.name = c.sname;

-- DEMO REVIEWS
INSERT INTO public.reviews (booking_id, worker_id, customer_name, rating, comment)
SELECT b.id, b.worker_id, b.customer_name,
  CASE WHEN random() < 0.6 THEN 5 ELSE 4 END,
  'Good work, arrived on time and completed the job neatly.'
FROM public.bookings b WHERE b.status = 'completed';

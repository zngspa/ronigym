
-- Exercise categories
CREATE TABLE public.exercise_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_categories TO authenticated;
GRANT ALL ON public.exercise_categories TO service_role;
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach exercise_categories all" ON public.exercise_categories FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
CREATE TRIGGER trg_exercise_categories_updated BEFORE UPDATE ON public.exercise_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Exercises
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category_id UUID REFERENCES public.exercise_categories ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_duration_seconds INTEGER NOT NULL DEFAULT 30,
  image_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach exercises all" ON public.exercises FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
CREATE TRIGGER trg_exercises_updated BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Workout plans
CREATE TABLE public.workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_rest_seconds INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plans TO authenticated;
GRANT ALL ON public.workout_plans TO service_role;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach workout_plans all" ON public.workout_plans FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
CREATE TRIGGER trg_workout_plans_updated BEFORE UPDATE ON public.workout_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Workout plan items (the ordered sequence of exercises inside a plan)
CREATE TABLE public.workout_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  workout_plan_id UUID NOT NULL REFERENCES public.workout_plans ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  rest_after_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plan_items TO authenticated;
GRANT ALL ON public.workout_plan_items TO service_role;
ALTER TABLE public.workout_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach workout_plan_items all" ON public.workout_plan_items FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_exercise_categories_coach ON public.exercise_categories(coach_id);
CREATE INDEX idx_exercises_coach ON public.exercises(coach_id);
CREATE INDEX idx_exercises_category ON public.exercises(category_id);
CREATE INDEX idx_workout_plans_coach ON public.workout_plans(coach_id);
CREATE INDEX idx_workout_plan_items_plan ON public.workout_plan_items(workout_plan_id, position);

-- Public storage bucket for exercise images
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-images', 'exercise-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "exercise images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'exercise-images');

CREATE POLICY "exercise images coach upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exercise-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "exercise images coach update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'exercise-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "exercise images coach delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exercise-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

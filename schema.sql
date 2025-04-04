-- Schema for the HabitOverflow application

-- Habit stacks table
CREATE TABLE habit_stacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Habits table
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stack_id UUID NOT NULL REFERENCES habit_stacks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL
);

-- User points table
CREATE TABLE user_points (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0 NOT NULL,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  last_activity_date DATE
);

-- Habit verification status table
CREATE TABLE habit_verifications (
  habit_id UUID PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  pending_verification BOOLEAN DEFAULT false NOT NULL,
  image_url TEXT,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- User profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add RLS policies (Row Level Security)
-- These policies ensure users can only access their own data

-- Habit stacks policy
ALTER TABLE habit_stacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY habit_stacks_policy ON habit_stacks 
  USING (user_id = auth.uid());

-- Habits policy (based on stack ownership)
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY habits_policy ON habits 
  USING (stack_id IN (SELECT id FROM habit_stacks WHERE user_id = auth.uid()));

-- User points policy
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_points_policy ON user_points 
  USING (user_id = auth.uid());

-- Verification policy (based on habit ownership)
ALTER TABLE habit_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY habit_verifications_policy ON habit_verifications 
  USING (habit_id IN (SELECT id FROM habits WHERE stack_id IN 
    (SELECT id FROM habit_stacks WHERE user_id = auth.uid())));

-- Profiles policy
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_policy ON profiles 
  USING (id = auth.uid());

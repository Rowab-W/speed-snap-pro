-- Create performance_records table to store acceleration measurements
CREATE TABLE public.performance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  max_speed DECIMAL(5,2) NOT NULL,
  max_acceleration DECIMAL(6,3) NOT NULL,
  measurement_duration INTEGER NOT NULL, -- in milliseconds
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.performance_records ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own performance records" 
ON public.performance_records 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own performance records" 
ON public.performance_records 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own performance records" 
ON public.performance_records 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_performance_records_user_id_recorded_at ON public.performance_records(user_id, recorded_at DESC);
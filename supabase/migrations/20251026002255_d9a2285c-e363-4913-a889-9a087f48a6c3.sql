-- Create delivery_notes table
CREATE TABLE delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  customer_phone TEXT,
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status TEXT CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
  extra_fields JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for delivery_notes
CREATE INDEX idx_delivery_notes_user ON delivery_notes(user_id);
CREATE INDEX idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX idx_delivery_notes_customer ON delivery_notes(customer_name);
CREATE INDEX idx_delivery_notes_issue_date ON delivery_notes(issue_date);

-- Create delivery_note_items table
CREATE TABLE delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID REFERENCES delivery_notes(id) ON DELETE CASCADE NOT NULL,
  product_id UUID,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for delivery_note_items
CREATE INDEX idx_delivery_note_items_note ON delivery_note_items(delivery_note_id);
CREATE INDEX idx_delivery_note_items_product ON delivery_note_items(product_id);

-- Enable RLS for delivery_notes
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_notes
CREATE POLICY "Users can view own delivery notes"
  ON delivery_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own delivery notes"
  ON delivery_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own delivery notes"
  ON delivery_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own delivery notes"
  ON delivery_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS for delivery_note_items
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_note_items
CREATE POLICY "Users can view items of own delivery notes"
  ON delivery_note_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM delivery_notes 
    WHERE id = delivery_note_items.delivery_note_id 
    AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create items for own delivery notes"
  ON delivery_note_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM delivery_notes 
    WHERE id = delivery_note_items.delivery_note_id 
    AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update items of own delivery notes"
  ON delivery_note_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM delivery_notes 
    WHERE id = delivery_note_items.delivery_note_id 
    AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items of own delivery notes"
  ON delivery_note_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM delivery_notes 
    WHERE id = delivery_note_items.delivery_note_id 
    AND user_id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_delivery_notes_updated_at
  BEFORE UPDATE ON delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
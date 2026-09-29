-- Cria o bucket/pasta de imagens de pedidos (se não existir)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('purchase-order-items', 'purchase-order-items', true)
ON CONFLICT (id) DO NOTHING;

-- Permite que usuários logados enviem fotos pra lá
CREATE POLICY "Allow authenticated uploads to purchase order items" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'purchase-order-items');

-- Permite que qualquer um leia (veja) as imagens
CREATE POLICY "Allow public read of purchase order items" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'purchase-order-items');

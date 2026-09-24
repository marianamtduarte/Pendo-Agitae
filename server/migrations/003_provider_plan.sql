-- Plano do fornecedor (Básico/Premium) e comissão específica por fornecedor (NULL = usa a comissão global das configurações).
ALTER TABLE providers ADD COLUMN plan TEXT NOT NULL DEFAULT 'basico' CHECK(plan IN('basico','premium'));
ALTER TABLE providers ADD COLUMN commission_bps INTEGER;
INSERT INTO settings(key,value) VALUES('premium_commission_bps','700');

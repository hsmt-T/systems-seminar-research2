INSERT INTO products (owner_id, sku, name, price, stock)
VALUES
    (1, 'SAMPLE-001', 'ワイヤレスマウス', 2980, 30),
    (1, 'SAMPLE-002', 'メカニカルキーボード', 8980, 15),
    (1, 'SAMPLE-003', 'USB-Cケーブル', 980, 100),
    (1, 'SAMPLE-004', 'ノートPCスタンド', 3480, 25),
    (1, 'SAMPLE-005', '27インチモニター', 24800, 10),
    (1, 'SAMPLE-006', 'ワイヤレスイヤホン', 5980, 40),
    (1, 'SAMPLE-007', 'USBハブ', 2480, 50),
    (1, 'SAMPLE-008', 'デスクマット', 1980, 0)
ON CONFLICT (sku) DO NOTHING;

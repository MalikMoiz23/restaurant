-- =====================================================================
-- Mesa POS - seed data
-- A realistic Portuguese restaurant: menu in pt/en/es/fr, floor plan,
-- staff PINs, and 60 days of trading history for the sales calendar.
-- =====================================================================

set client_encoding = 'UTF8';

truncate table audit_log, daily_closeout, bill_split_item, bill_split, bill,
  waiter_call, order_item, customer_order, table_session, restaurant_table,
  zone, menu_item_diet, menu_item_allergen, menu_item_i18n, menu_item,
  menu_category_i18n, menu_category, diet_tag, allergen, staff
  restart identity cascade;

-- ---------------------------------------------------------------------
-- Staff. PINs are bcrypt-hashed by pgcrypto, never stored in clear.
-- Demo PINs: Ana 1234 / Bruno 2345 / Rui 3456 / Ines 4567 / Tiago 5678
-- ---------------------------------------------------------------------
insert into staff (name, role, pin_hash) values
  ('Ana Sousa',     'manager', crypt('1234', gen_salt('bf', 10))),
  ('Bruno Costa',   'cashier', crypt('2345', gen_salt('bf', 10))),
  ('Rui Alves',     'kitchen', crypt('3456', gen_salt('bf', 10))),
  ('Inês Martins',  'waiter',  crypt('4567', gen_salt('bf', 10))),
  ('Tiago Ferreira','waiter',  crypt('5678', gen_salt('bf', 10)));

-- ---------------------------------------------------------------------
-- The 14 EU declarable allergens
-- ---------------------------------------------------------------------
insert into allergen (code, name_pt, name_en, name_es, name_fr, icon) values
  ('gluten',      'Glúten',              'Gluten',          'Gluten',            'Gluten',           'WHEAT'),
  ('crustaceans', 'Crustáceos',          'Crustaceans',     'Crustáceos',        'Crustacés',        'SHRIMP'),
  ('eggs',        'Ovos',                'Eggs',            'Huevos',            'Œufs',             'EGG'),
  ('fish',        'Peixe',               'Fish',            'Pescado',           'Poisson',          'FISH'),
  ('peanuts',     'Amendoins',           'Peanuts',         'Cacahuetes',        'Arachides',        'PEANUT'),
  ('soy',         'Soja',                'Soy',             'Soja',              'Soja',             'SOY'),
  ('milk',        'Leite',               'Milk',            'Leche',             'Lait',             'MILK'),
  ('nuts',        'Frutos de casca rija','Tree nuts',       'Frutos secos',      'Fruits à coque',   'NUT'),
  ('celery',      'Aipo',                'Celery',          'Apio',              'Céleri',           'CELERY'),
  ('mustard',     'Mostarda',            'Mustard',         'Mostaza',           'Moutarde',         'MUSTARD'),
  ('sesame',      'Sésamo',              'Sesame',          'Sésamo',            'Sésame',           'SESAME'),
  ('sulphites',   'Sulfitos',            'Sulphites',       'Sulfitos',          'Sulfites',         'SULPHITE'),
  ('lupin',       'Tremoço',             'Lupin',           'Altramuces',        'Lupin',            'LUPIN'),
  ('molluscs',    'Moluscos',            'Molluscs',        'Moluscos',          'Mollusques',       'SQUID');

insert into diet_tag (code, name_pt, name_en, name_es, name_fr, icon) values
  ('vegan',       'Vegano',        'Vegan',        'Vegano',        'Végan',          'LEAF'),
  ('vegetarian',  'Vegetariano',   'Vegetarian',   'Vegetariano',   'Végétarien',     'SPROUT'),
  ('gluten_free', 'Sem glúten',    'Gluten-free',  'Sin gluten',    'Sans gluten',    'NOGLUTEN'),
  ('spicy',       'Picante',       'Spicy',        'Picante',       'Épicé',          'CHILLI'),
  ('house',       'Especialidade', 'House special','Especialidad',  'Spécialité',     'STAR');

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------
insert into menu_category (code, icon, sort_order) values
  ('entradas',    'OLIVE',   1),
  ('sopas',       'BOWL',    2),
  ('peixe',       'FISH',    3),
  ('carne',       'MEAT',    4),
  ('vegetariano', 'LEAF',    5),
  ('sobremesas',  'CAKE',    6),
  ('bebidas',     'CUP',     7),
  ('vinhos',      'WINE',    8);

insert into menu_category_i18n (category_id, locale, name)
select c.id, v.locale, v.name
from (values
  ('entradas','pt','Entradas'),      ('entradas','en','Starters'),        ('entradas','es','Entrantes'),      ('entradas','fr','Entrées'),
  ('sopas','pt','Sopas'),            ('sopas','en','Soups'),              ('sopas','es','Sopas'),             ('sopas','fr','Soupes'),
  ('peixe','pt','Peixe & Marisco'),  ('peixe','en','Fish & Seafood'),     ('peixe','es','Pescado y Marisco'), ('peixe','fr','Poissons & Fruits de mer'),
  ('carne','pt','Carnes'),           ('carne','en','Meat'),               ('carne','es','Carnes'),            ('carne','fr','Viandes'),
  ('vegetariano','pt','Vegetariano'),('vegetariano','en','Vegetarian'),   ('vegetariano','es','Vegetariano'), ('vegetariano','fr','Végétarien'),
  ('sobremesas','pt','Sobremesas'),  ('sobremesas','en','Desserts'),      ('sobremesas','es','Postres'),      ('sobremesas','fr','Desserts'),
  ('bebidas','pt','Bebidas'),        ('bebidas','en','Drinks'),           ('bebidas','es','Bebidas'),         ('bebidas','fr','Boissons'),
  ('vinhos','pt','Vinhos & Cerveja'),('vinhos','en','Wine & Beer'),       ('vinhos','es','Vinos y Cerveza'),  ('vinhos','fr','Vins & Bières')
) as v(code, locale, name)
join menu_category c on c.code = v.code;

-- ---------------------------------------------------------------------
-- Menu items.
-- Prices are IVA-inclusive, in cents.
-- IVA 13% = catering food, coffee, tea, still water.
-- IVA 23% = alcohol, soft drinks, juices, sparkling water.
-- ---------------------------------------------------------------------
insert into menu_item (category_id, sku, price_cents, vat_rate, glyph, is_alcoholic, prep_minutes, kitchen_station, sort_order)
select c.id, v.sku, v.price, v.vat, v.glyph, v.alc, v.prep, v.station, v.sort
from (values
  -- Entradas
  ('entradas','pao-manteiga',       180, 13.00, 'BREAD',   false,  3, 'cozinha',    1),
  ('entradas','azeitonas',          250, 13.00, 'OLIVE',   false,  2, 'cozinha',    2),
  ('entradas','queijo-serra',       750, 13.00, 'CHEESE',  false,  5, 'cozinha',    3),
  ('entradas','presunto',           950, 13.00, 'HAM',     false,  5, 'cozinha',    4),
  ('entradas','alheira',            890, 13.00, 'SAUSAGE', false, 14, 'grelha',     5),
  ('entradas','pica-pau',           850, 13.00, 'MEAT',    false, 12, 'cozinha',    6),
  ('entradas','ameijoas',          1250, 13.00, 'SHELL',   false, 12, 'cozinha',    7),
  -- Sopas
  ('sopas','caldo-verde',           380, 13.00, 'BOWL',    false,  6, 'cozinha',    1),
  ('sopas','sopa-legumes',          320, 13.00, 'BOWL',    false,  5, 'cozinha',    2),
  ('sopas','creme-abobora',         360, 13.00, 'BOWL',    false,  5, 'cozinha',    3),
  -- Peixe & Marisco
  ('peixe','bacalhau-bras',        1450, 13.00, 'FISH',    false, 18, 'cozinha',    1),
  ('peixe','bacalhau-lagareiro',   1790, 13.00, 'FISH',    false, 25, 'grelha',     2),
  ('peixe','polvo-lagareiro',      1950, 13.00, 'SQUID',   false, 28, 'grelha',     3),
  ('peixe','sardinhas',            1300, 13.00, 'FISH',    false, 16, 'grelha',     4),
  ('peixe','robalo',               1850, 13.00, 'FISH',    false, 22, 'grelha',     5),
  ('peixe','arroz-marisco',        2100, 13.00, 'SHRIMP',  false, 32, 'cozinha',    6),
  -- Carnes
  ('carne','francesinha',          1250, 13.00, 'SANDWICH',false, 18, 'cozinha',    1),
  ('carne','bifana',                550, 13.00, 'SANDWICH',false,  8, 'cozinha',    2),
  ('carne','bitoque',              1150, 13.00, 'STEAK',   false, 16, 'grelha',     3),
  ('carne','frango-churrasco',     1050, 13.00, 'CHICKEN', false, 22, 'grelha',     4),
  ('carne','picanha',              1990, 13.00, 'STEAK',   false, 24, 'grelha',     5),
  ('carne','leitao',               1750, 13.00, 'MEAT',    false, 20, 'cozinha',    6),
  ('carne','cozido',               1650, 13.00, 'POT',     false, 26, 'cozinha',    7),
  -- Vegetariano
  ('vegetariano','legumes-grelhados',1100, 13.00,'BROCCOLI',false, 14, 'grelha',    1),
  ('vegetariano','risoto-cogumelos', 1350, 13.00,'RICE',    false, 20, 'cozinha',   2),
  ('vegetariano','burger-grao',      1250, 13.00,'BURGER',  false, 16, 'grelha',    3),
  ('vegetariano','acorda-veg',       1050, 13.00,'BOWL',    false, 15, 'cozinha',   4),
  -- Sobremesas
  ('sobremesas','pastel-nata',       140, 13.00, 'TART',    false,  2, 'pastelaria',1),
  ('sobremesas','arroz-doce',        350, 13.00, 'PUDDING', false,  3, 'pastelaria',2),
  ('sobremesas','leite-creme',       420, 13.00, 'PUDDING', false,  4, 'pastelaria',3),
  ('sobremesas','mousse-chocolate',  450, 13.00, 'CHOCO',   false,  3, 'pastelaria',4),
  ('sobremesas','pudim-abade',       480, 13.00, 'PUDDING', false,  3, 'pastelaria',5),
  ('sobremesas','bolo-bolacha',      400, 13.00, 'CAKE',    false,  3, 'pastelaria',6),
  ('sobremesas','toucinho-ceu',      460, 13.00, 'CAKE',    false,  3, 'pastelaria',7),
  -- Bebidas
  ('bebidas','cafe',                  90, 13.00, 'COFFEE',  false,  2, 'bar',       1),
  ('bebidas','meia-leite',           140, 13.00, 'COFFEE',  false,  3, 'bar',       2),
  ('bebidas','galao',                160, 13.00, 'COFFEE',  false,  3, 'bar',       3),
  ('bebidas','cha',                  150, 13.00, 'TEA',     false,  3, 'bar',       4),
  ('bebidas','agua-50',              150, 13.00, 'WATER',   false,  1, 'bar',       5),
  ('bebidas','agua-gas',             180, 23.00, 'WATER',   false,  1, 'bar',       6),
  ('bebidas','coca-cola',            220, 23.00, 'SODA',    false,  1, 'bar',       7),
  ('bebidas','sumol',                220, 23.00, 'SODA',    false,  1, 'bar',       8),
  ('bebidas','sumo-laranja',         320, 23.00, 'JUICE',   false,  4, 'bar',       9),
  -- Vinhos & Cerveja
  ('vinhos','sagres',                160, 23.00, 'BEER',    true,   1, 'bar',       1),
  ('vinhos','superbock',             200, 23.00, 'BEER',    true,   1, 'bar',       2),
  ('vinhos','vinho-verde-copo',      280, 23.00, 'WINE',    true,   2, 'bar',       3),
  ('vinhos','ginjinha',              300, 23.00, 'LIQUEUR', true,   1, 'bar',       4),
  ('vinhos','porto-tonico',          550, 23.00, 'COCKTAIL',true,   4, 'bar',       5),
  ('vinhos','sangria',              1200, 23.00, 'COCKTAIL',true,   6, 'bar',       6),
  ('vinhos','alentejo-tinto',       1600, 23.00, 'WINE',    true,   2, 'bar',       7),
  ('vinhos','douro-tinto',          1800, 23.00, 'WINE',    true,   2, 'bar',       8)
) as v(cat, sku, price, vat, glyph, alc, prep, station, sort)
join menu_category c on c.code = v.cat;

-- ---------------------------------------------------------------------
-- Item names and descriptions, four locales
-- ---------------------------------------------------------------------
insert into menu_item_i18n (item_id, locale, name, description)
select m.id, v.locale, v.name, v.descr
from (values
  -- pao-manteiga
  ('pao-manteiga','pt','Pão com Manteiga','Broa de milho quente com manteiga dos Açores'),
  ('pao-manteiga','en','Bread & Butter','Warm cornbread with Azorean butter'),
  ('pao-manteiga','es','Pan con Mantequilla','Pan de maíz caliente con mantequilla de las Azores'),
  ('pao-manteiga','fr','Pain et Beurre','Pain de maïs chaud, beurre des Açores'),
  -- azeitonas
  ('azeitonas','pt','Azeitonas Marinadas','Azeitonas galega com alho, orégãos e azeite'),
  ('azeitonas','en','Marinated Olives','Galega olives with garlic, oregano and olive oil'),
  ('azeitonas','es','Aceitunas Marinadas','Aceitunas galega con ajo, orégano y aceite de oliva'),
  ('azeitonas','fr','Olives Marinées','Olives galega à l''ail, origan et huile d''olive'),
  -- queijo-serra
  ('queijo-serra','pt','Queijo da Serra da Estrela','Queijo amanteigado DOP, curado em cave'),
  ('queijo-serra','en','Serra da Estrela Cheese','Buttery PDO sheep cheese, cellar-aged'),
  ('queijo-serra','es','Queso Serra da Estrela','Queso de oveja DOP mantecoso, curado en cueva'),
  ('queijo-serra','fr','Fromage Serra da Estrela','Fromage de brebis AOP crémeux, affiné en cave'),
  -- presunto
  ('presunto','pt','Presunto de Barrancos','Presunto de porco alentejano, cura de 24 meses'),
  ('presunto','en','Barrancos Cured Ham','Alentejo black pork ham, 24-month cure'),
  ('presunto','es','Jamón de Barrancos','Jamón de cerdo alentejano, curación de 24 meses'),
  ('presunto','fr','Jambon de Barrancos','Jambon de porc noir d''Alentejo, affiné 24 mois'),
  -- alheira
  ('alheira','pt','Alheira de Mirandela','Assada no forno com batata a murro e grelos'),
  ('alheira','en','Mirandela Alheira Sausage','Oven-baked, with smashed potatoes and turnip tops'),
  ('alheira','es','Alheira de Mirandela','Al horno con patatas machacadas y grelos'),
  ('alheira','fr','Saucisse Alheira de Mirandela','Cuite au four, pommes de terre écrasées et navets'),
  -- pica-pau
  ('pica-pau','pt','Pica-Pau','Naco de vaca salteado em cerveja, pickles e mostarda'),
  ('pica-pau','en','Pica-Pau Beef Bites','Beef sautéed in beer with pickles and mustard'),
  ('pica-pau','es','Pica-Pau','Ternera salteada en cerveza con pepinillos y mostaza'),
  ('pica-pau','fr','Pica-Pau','Bœuf sauté à la bière, cornichons et moutarde'),
  -- ameijoas
  ('ameijoas','pt','Ameijoas à Bulhão Pato','Ameijoas com alho, coentros, limão e vinho branco'),
  ('ameijoas','en','Clams Bulhão Pato','Clams with garlic, coriander, lemon and white wine'),
  ('ameijoas','es','Almejas a Bulhão Pato','Almejas con ajo, cilantro, limón y vino blanco'),
  ('ameijoas','fr','Palourdes Bulhão Pato','Palourdes à l''ail, coriandre, citron et vin blanc'),
  -- caldo-verde
  ('caldo-verde','pt','Caldo Verde','Couve galega, batata, azeite e rodela de chouriço'),
  ('caldo-verde','en','Caldo Verde','Collard greens, potato, olive oil and chouriço'),
  ('caldo-verde','es','Caldo Verde','Berza, patata, aceite de oliva y chorizo'),
  ('caldo-verde','fr','Caldo Verde','Chou vert, pomme de terre, huile d''olive et chouriço'),
  -- sopa-legumes
  ('sopa-legumes','pt','Sopa de Legumes','Legumes da horta passados, feita no dia'),
  ('sopa-legumes','en','Garden Vegetable Soup','Puréed seasonal vegetables, made fresh daily'),
  ('sopa-legumes','es','Sopa de Verduras','Verduras de temporada trituradas, hecha del día'),
  ('sopa-legumes','fr','Soupe de Légumes','Légumes de saison mixés, préparée du jour'),
  -- creme-abobora
  ('creme-abobora','pt','Creme de Abóbora','Abóbora assada, gengibre e um fio de nata'),
  ('creme-abobora','en','Pumpkin Velvet Soup','Roasted pumpkin, ginger and a swirl of cream'),
  ('creme-abobora','es','Crema de Calabaza','Calabaza asada, jengibre y un hilo de nata'),
  ('creme-abobora','fr','Velouté de Potiron','Potiron rôti, gingembre et filet de crème'),
  -- bacalhau-bras
  ('bacalhau-bras','pt','Bacalhau à Brás','Bacalhau desfiado, batata palha, ovo e azeitonas'),
  ('bacalhau-bras','en','Bacalhau à Brás','Shredded cod, straw potatoes, egg and olives'),
  ('bacalhau-bras','es','Bacalao a Brás','Bacalao desmigado, patatas paja, huevo y aceitunas'),
  ('bacalhau-bras','fr','Morue à Brás','Morue effilée, pommes paille, œuf et olives'),
  -- bacalhau-lagareiro
  ('bacalhau-lagareiro','pt','Bacalhau à Lagareiro','Lombo assado no azeite com batata a murro'),
  ('bacalhau-lagareiro','en','Cod à Lagareiro','Loin roasted in olive oil with smashed potatoes'),
  ('bacalhau-lagareiro','es','Bacalao a Lagareiro','Lomo asado en aceite de oliva con patatas'),
  ('bacalhau-lagareiro','fr','Morue à Lagareiro','Dos rôti à l''huile d''olive, pommes écrasées'),
  -- polvo-lagareiro
  ('polvo-lagareiro','pt','Polvo à Lagareiro','Polvo assado no azeite, alho e batata a murro'),
  ('polvo-lagareiro','en','Octopus à Lagareiro','Octopus roasted in olive oil, garlic and potatoes'),
  ('polvo-lagareiro','es','Pulpo a Lagareiro','Pulpo asado en aceite de oliva, ajo y patatas'),
  ('polvo-lagareiro','fr','Poulpe à Lagareiro','Poulpe rôti à l''huile d''olive, ail et pommes'),
  -- sardinhas
  ('sardinhas','pt','Sardinhas Assadas','Sardinha da costa na brasa, pimento assado e broa'),
  ('sardinhas','en','Grilled Sardines','Coastal sardines over charcoal, roast pepper, cornbread'),
  ('sardinhas','es','Sardinas Asadas','Sardinas a la brasa, pimiento asado y pan de maíz'),
  ('sardinhas','fr','Sardines Grillées','Sardines au charbon, poivron rôti et pain de maïs'),
  -- robalo
  ('robalo','pt','Robalo Grelhado','Robalo inteiro na grelha, legumes e azeite de limão'),
  ('robalo','en','Grilled Sea Bass','Whole sea bass, seasonal vegetables, lemon oil'),
  ('robalo','es','Lubina a la Parrilla','Lubina entera, verduras y aceite de limón'),
  ('robalo','fr','Bar Grillé','Bar entier grillé, légumes et huile citronnée'),
  -- arroz-marisco
  ('arroz-marisco','pt','Arroz de Marisco','Arroz malandrinho com camarão, ameijoa e sapateira'),
  ('arroz-marisco','en','Seafood Rice','Soupy rice with prawn, clams and brown crab'),
  ('arroz-marisco','es','Arroz de Marisco','Arroz caldoso con gamba, almeja y buey de mar'),
  ('arroz-marisco','fr','Riz aux Fruits de Mer','Riz crémeux, crevettes, palourdes et tourteau'),
  -- francesinha
  ('francesinha','pt','Francesinha do Porto','Pão, fiambre, linguiça e bife com molho da casa'),
  ('francesinha','en','Porto Francesinha','Bread, ham, sausage and steak under house sauce'),
  ('francesinha','es','Francesinha de Oporto','Pan, jamón, salchicha y filete con salsa de la casa'),
  ('francesinha','fr','Francesinha de Porto','Pain, jambon, saucisse et steak, sauce maison'),
  -- bifana
  ('bifana','pt','Bifana no Pão','Bifana de porco marinada em alho e vinho branco'),
  ('bifana','en','Bifana Pork Roll','Pork steak marinated in garlic and white wine'),
  ('bifana','es','Bifana en Pan','Filete de cerdo marinado en ajo y vino blanco'),
  ('bifana','fr','Bifana en Pain','Escalope de porc marinée à l''ail et vin blanc'),
  -- bitoque
  ('bitoque','pt','Bitoque à Portuguesa','Bife do lombo, ovo a cavalo, batata frita e arroz'),
  ('bitoque','en','Portuguese Bitoque','Sirloin steak, fried egg, chips and rice'),
  ('bitoque','es','Bitoque a la Portuguesa','Filete de lomo, huevo frito, patatas y arroz'),
  ('bitoque','fr','Bitoque à la Portugaise','Steak de filet, œuf au plat, frites et riz'),
  -- frango-churrasco
  ('frango-churrasco','pt','Frango no Churrasco','Meio frango na brasa com piri-piri da casa'),
  ('frango-churrasco','en','Charcoal Chicken','Half chicken over charcoal with house piri-piri'),
  ('frango-churrasco','es','Pollo a la Brasa','Medio pollo a la brasa con piri-piri de la casa'),
  ('frango-churrasco','fr','Poulet au Charbon','Demi-poulet grillé, piri-piri maison'),
  -- picanha
  ('picanha','pt','Picanha Grelhada','Picanha maturada, flor de sal e batata rústica'),
  ('picanha','en','Grilled Picanha','Aged rump cap, sea salt flakes and rustic potatoes'),
  ('picanha','es','Picanha a la Parrilla','Tapa de cuadril madurada, flor de sal y patatas'),
  ('picanha','fr','Picanha Grillée','Aiguillette maturée, fleur de sel et pommes rustiques'),
  -- leitao
  ('leitao','pt','Leitão da Bairrada','Leitão assado com pele crocante e laranja'),
  ('leitao','en','Bairrada Suckling Pig','Roast suckling pig, crackling skin and orange'),
  ('leitao','es','Cochinillo de Bairrada','Cochinillo asado con piel crujiente y naranja'),
  ('leitao','fr','Cochon de Lait de Bairrada','Cochon de lait rôti, peau croustillante et orange'),
  -- cozido
  ('cozido','pt','Cozido à Portuguesa','Carnes, enchidos e legumes cozidos lentamente'),
  ('cozido','en','Cozido à Portuguesa','Slow-boiled meats, smoked sausage and vegetables'),
  ('cozido','es','Cocido a la Portuguesa','Carnes, embutidos y verduras cocidos lentamente'),
  ('cozido','fr','Pot-au-feu Portugais','Viandes, charcuterie et légumes mijotés'),
  -- legumes-grelhados
  ('legumes-grelhados','pt','Legumes Grelhados na Brasa','Legumes da estação na brasa com azeite e ervas'),
  ('legumes-grelhados','en','Charcoal Grilled Vegetables','Seasonal vegetables over charcoal, olive oil, herbs'),
  ('legumes-grelhados','es','Verduras a la Brasa','Verduras de temporada a la brasa con aceite y hierbas'),
  ('legumes-grelhados','fr','Légumes Grillés au Charbon','Légumes de saison grillés, huile d''olive et herbes'),
  -- risoto-cogumelos
  ('risoto-cogumelos','pt','Risoto de Cogumelos','Arroz carolino, cogumelos silvestres e queijo curado'),
  ('risoto-cogumelos','en','Wild Mushroom Risotto','Carolino rice, wild mushrooms and aged cheese'),
  ('risoto-cogumelos','es','Risotto de Setas','Arroz carolino, setas silvestres y queso curado'),
  ('risoto-cogumelos','fr','Risotto aux Champignons','Riz carolino, champignons sauvages et fromage affiné'),
  -- burger-grao
  ('burger-grao','pt','Burger de Grão-de-Bico','Grão, coentros, pão de sésamo e maionese vegetal'),
  ('burger-grao','en','Chickpea Burger','Chickpea, coriander, sesame bun and vegan mayo'),
  ('burger-grao','es','Hamburguesa de Garbanzo','Garbanzo, cilantro, pan de sésamo y mayonesa vegetal'),
  ('burger-grao','fr','Burger de Pois Chiches','Pois chiches, coriandre, pain sésame et mayo végétale'),
  -- acorda-veg
  ('acorda-veg','pt','Açorda Alentejana Vegetariana','Pão alentejano, coentros, alho e ovo escalfado'),
  ('acorda-veg','en','Vegetarian Açorda','Alentejo bread, coriander, garlic and poached egg'),
  ('acorda-veg','es','Açorda Alentejana Vegetariana','Pan alentejano, cilantro, ajo y huevo escalfado'),
  ('acorda-veg','fr','Açorda Végétarienne','Pain d''Alentejo, coriandre, ail et œuf poché'),
  -- pastel-nata
  ('pastel-nata','pt','Pastel de Nata','Massa folhada crocante, creme queimado e canela'),
  ('pastel-nata','en','Pastel de Nata','Crisp puff pastry, scorched custard and cinnamon'),
  ('pastel-nata','es','Pastel de Nata','Hojaldre crujiente, crema quemada y canela'),
  ('pastel-nata','fr','Pastel de Nata','Pâte feuilletée croustillante, crème brûlée, cannelle'),
  -- arroz-doce
  ('arroz-doce','pt','Arroz Doce','Arroz cremoso com limão e canela em pó'),
  ('arroz-doce','en','Portuguese Rice Pudding','Creamy lemon rice dusted with cinnamon'),
  ('arroz-doce','es','Arroz con Leche','Arroz cremoso con limón y canela en polvo'),
  ('arroz-doce','fr','Riz au Lait Portugais','Riz crémeux au citron et cannelle'),
  -- leite-creme
  ('leite-creme','pt','Leite-Creme Queimado','Creme de baunilha com açúcar queimado na hora'),
  ('leite-creme','en','Torched Leite-Creme','Vanilla custard with sugar caramelised to order'),
  ('leite-creme','es','Leite-Creme Quemado','Crema de vainilla con azúcar quemado al momento'),
  ('leite-creme','fr','Leite-Creme Brûlé','Crème vanille, sucre caramélisé à la commande'),
  -- mousse-chocolate
  ('mousse-chocolate','pt','Mousse de Chocolate','Chocolate 70% com flor de sal'),
  ('mousse-chocolate','en','Chocolate Mousse','70% dark chocolate with sea salt flakes'),
  ('mousse-chocolate','es','Mousse de Chocolate','Chocolate 70% con flor de sal'),
  ('mousse-chocolate','fr','Mousse au Chocolat','Chocolat 70% et fleur de sel'),
  -- pudim-abade
  ('pudim-abade','pt','Pudim Abade de Priscos','Pudim de gemas, toucinho e Vinho do Porto'),
  ('pudim-abade','en','Abade de Priscos Pudding','Egg-yolk pudding with lard and Port wine'),
  ('pudim-abade','es','Pudín Abade de Priscos','Pudín de yemas, tocino y vino de Oporto'),
  ('pudim-abade','fr','Pudding Abade de Priscos','Pudding aux jaunes d''œufs, lard et Porto'),
  -- bolo-bolacha
  ('bolo-bolacha','pt','Bolo de Bolacha','Camadas de bolacha Maria e creme de manteiga'),
  ('bolo-bolacha','en','Biscuit Cake','Layers of Maria biscuit and buttercream'),
  ('bolo-bolacha','es','Tarta de Galleta','Capas de galleta María y crema de mantequilla'),
  ('bolo-bolacha','fr','Gâteau de Biscuits','Couches de biscuit Maria et crème au beurre'),
  -- toucinho-ceu
  ('toucinho-ceu','pt','Toucinho do Céu','Doce conventual de amêndoa e gema'),
  ('toucinho-ceu','en','Toucinho do Céu','Convent almond and egg-yolk cake'),
  ('toucinho-ceu','es','Toucinho do Céu','Dulce conventual de almendra y yema'),
  ('toucinho-ceu','fr','Toucinho do Céu','Gâteau conventuel amande et jaune d''œuf'),
  -- cafe
  ('cafe','pt','Café Expresso','Torra escura, lote da casa'),
  ('cafe','en','Espresso','Dark roast, house blend'),
  ('cafe','es','Café Expreso','Tueste oscuro, mezcla de la casa'),
  ('cafe','fr','Café Expresso','Torréfaction foncée, mélange maison'),
  -- meia-leite
  ('meia-leite','pt','Meia de Leite','Metade café, metade leite vaporizado'),
  ('meia-leite','en','Meia de Leite','Half espresso, half steamed milk'),
  ('meia-leite','es','Meia de Leite','Mitad café, mitad leche vaporizada'),
  ('meia-leite','fr','Meia de Leite','Moitié café, moitié lait vapeur'),
  -- galao
  ('galao','pt','Galão','Café com leite servido em copo alto'),
  ('galao','en','Galão','Milky coffee served in a tall glass'),
  ('galao','es','Galão','Café con leche en vaso alto'),
  ('galao','fr','Galão','Café au lait servi en verre haut'),
  -- cha
  ('cha','pt','Chá','Hortelã fresca, limão ou preto dos Açores'),
  ('cha','en','Tea','Fresh mint, lemon or Azorean black'),
  ('cha','es','Té','Menta fresca, limón o negro de las Azores'),
  ('cha','fr','Thé','Menthe fraîche, citron ou noir des Açores'),
  -- agua-50
  ('agua-50','pt','Água 50cl','Água mineral natural, nascente portuguesa'),
  ('agua-50','en','Still Water 50cl','Natural mineral water, Portuguese spring'),
  ('agua-50','es','Agua 50cl','Agua mineral natural, manantial portugués'),
  ('agua-50','fr','Eau Plate 50cl','Eau minérale naturelle, source portugaise'),
  -- agua-gas
  ('agua-gas','pt','Água com Gás 50cl','Água mineral gaseificada'),
  ('agua-gas','en','Sparkling Water 50cl','Carbonated mineral water'),
  ('agua-gas','es','Agua con Gas 50cl','Agua mineral con gas'),
  ('agua-gas','fr','Eau Gazeuse 50cl','Eau minérale gazéifiée'),
  -- coca-cola
  ('coca-cola','pt','Coca-Cola 33cl','Servida bem fresca com limão'),
  ('coca-cola','en','Coca-Cola 33cl','Served well chilled with lemon'),
  ('coca-cola','es','Coca-Cola 33cl','Servida bien fría con limón'),
  ('coca-cola','fr','Coca-Cola 33cl','Servi bien frais avec citron'),
  -- sumol
  ('sumol','pt','Sumol Laranja 33cl','Refrigerante de laranja com polpa'),
  ('sumol','en','Sumol Orange 33cl','Orange soda with real pulp'),
  ('sumol','es','Sumol Naranja 33cl','Refresco de naranja con pulpa'),
  ('sumol','fr','Sumol Orange 33cl','Soda à l''orange avec pulpe'),
  -- sumo-laranja
  ('sumo-laranja','pt','Sumo de Laranja Natural','Laranja do Algarve espremida na hora'),
  ('sumo-laranja','en','Fresh Orange Juice','Algarve oranges squeezed to order'),
  ('sumo-laranja','es','Zumo de Naranja Natural','Naranja del Algarve recién exprimida'),
  ('sumo-laranja','fr','Jus d''Orange Pressé','Oranges de l''Algarve pressées à la commande'),
  -- sagres
  ('sagres','pt','Sagres Imperial 20cl','Imperial tirada à pressão'),
  ('sagres','en','Sagres Draught 20cl','Small draught beer'),
  ('sagres','es','Sagres de Barril 20cl','Caña de cerveza de barril'),
  ('sagres','fr','Sagres Pression 20cl','Petite bière pression'),
  -- superbock
  ('superbock','pt','Super Bock 33cl','Cerveja lager em garrafa'),
  ('superbock','en','Super Bock 33cl','Bottled lager'),
  ('superbock','es','Super Bock 33cl','Cerveza lager en botella'),
  ('superbock','fr','Super Bock 33cl','Bière lager en bouteille'),
  -- vinho-verde-copo
  ('vinho-verde-copo','pt','Vinho Verde (copo)','Alvarinho jovem, cítrico e leve'),
  ('vinho-verde-copo','en','Vinho Verde (glass)','Young Alvarinho, citrus and light'),
  ('vinho-verde-copo','es','Vinho Verde (copa)','Alvarinho joven, cítrico y ligero'),
  ('vinho-verde-copo','fr','Vinho Verde (verre)','Alvarinho jeune, citronné et léger'),
  -- ginjinha
  ('ginjinha','pt','Ginjinha','Licor de ginja de Óbidos, com ou sem fruto'),
  ('ginjinha','en','Ginjinha','Óbidos sour-cherry liqueur, with or without fruit'),
  ('ginjinha','es','Ginjinha','Licor de guinda de Óbidos, con o sin fruta'),
  ('ginjinha','fr','Ginjinha','Liqueur de griotte d''Óbidos, avec ou sans fruit'),
  -- porto-tonico
  ('porto-tonico','pt','Porto Tónico','Porto branco seco, tónica e casca de limão'),
  ('porto-tonico','en','Port & Tonic','Dry white Port, tonic and lemon peel'),
  ('porto-tonico','es','Oporto Tónico','Oporto blanco seco, tónica y piel de limón'),
  ('porto-tonico','fr','Porto Tonic','Porto blanc sec, tonic et zeste de citron'),
  -- sangria
  ('sangria','pt','Sangria Branca (1L)','Vinho branco, fruta da estação e hortelã'),
  ('sangria','en','White Sangria (1L)','White wine, seasonal fruit and mint'),
  ('sangria','es','Sangría Blanca (1L)','Vino blanco, fruta de temporada y menta'),
  ('sangria','fr','Sangria Blanche (1L)','Vin blanc, fruits de saison et menthe'),
  -- alentejo-tinto
  ('alentejo-tinto','pt','Alentejo Tinto (garrafa)','Aragonez e Trincadeira, taninos macios'),
  ('alentejo-tinto','en','Alentejo Red (bottle)','Aragonez and Trincadeira, soft tannins'),
  ('alentejo-tinto','es','Alentejo Tinto (botella)','Aragonez y Trincadeira, taninos suaves'),
  ('alentejo-tinto','fr','Alentejo Rouge (bouteille)','Aragonez et Trincadeira, tanins souples'),
  -- douro-tinto
  ('douro-tinto','pt','Douro Tinto (garrafa)','Touriga Nacional, estágio em carvalho'),
  ('douro-tinto','en','Douro Red (bottle)','Touriga Nacional, oak-aged'),
  ('douro-tinto','es','Douro Tinto (botella)','Touriga Nacional, crianza en roble'),
  ('douro-tinto','fr','Douro Rouge (bouteille)','Touriga Nacional, élevé en chêne')
) as v(sku, locale, name, descr)
join menu_item m on m.sku = v.sku;

-- ---------------------------------------------------------------------
-- Allergen mapping
-- ---------------------------------------------------------------------
insert into menu_item_allergen (item_id, allergen_code)
select m.id, v.code
from (values
  ('pao-manteiga','gluten'),('pao-manteiga','milk'),
  ('azeitonas','sulphites'),
  ('queijo-serra','milk'),
  ('alheira','gluten'),
  ('pica-pau','gluten'),('pica-pau','mustard'),('pica-pau','sulphites'),
  ('ameijoas','molluscs'),('ameijoas','sulphites'),
  ('sopa-legumes','celery'),
  ('creme-abobora','milk'),('creme-abobora','celery'),
  ('bacalhau-bras','fish'),('bacalhau-bras','eggs'),('bacalhau-bras','milk'),('bacalhau-bras','sulphites'),
  ('bacalhau-lagareiro','fish'),
  ('polvo-lagareiro','molluscs'),
  ('sardinhas','fish'),('sardinhas','gluten'),
  ('robalo','fish'),
  ('arroz-marisco','crustaceans'),('arroz-marisco','molluscs'),('arroz-marisco','fish'),
  ('francesinha','gluten'),('francesinha','milk'),('francesinha','mustard'),('francesinha','sulphites'),
  ('bifana','gluten'),('bifana','mustard'),
  ('bitoque','eggs'),('bitoque','gluten'),('bitoque','milk'),
  ('frango-churrasco','sulphites'),
  ('leitao','sulphites'),
  ('cozido','celery'),('cozido','sulphites'),
  ('risoto-cogumelos','milk'),('risoto-cogumelos','sulphites'),
  ('burger-grao','gluten'),('burger-grao','sesame'),('burger-grao','soy'),
  ('acorda-veg','gluten'),('acorda-veg','eggs'),
  ('pastel-nata','gluten'),('pastel-nata','milk'),('pastel-nata','eggs'),
  ('arroz-doce','milk'),('arroz-doce','eggs'),
  ('leite-creme','milk'),('leite-creme','eggs'),
  ('mousse-chocolate','milk'),('mousse-chocolate','eggs'),('mousse-chocolate','soy'),
  ('pudim-abade','eggs'),('pudim-abade','sulphites'),
  ('bolo-bolacha','gluten'),('bolo-bolacha','milk'),('bolo-bolacha','eggs'),
  ('toucinho-ceu','eggs'),('toucinho-ceu','nuts'),
  ('meia-leite','milk'),
  ('galao','milk'),
  ('sagres','gluten'),('sagres','sulphites'),
  ('superbock','gluten'),('superbock','sulphites'),
  ('vinho-verde-copo','sulphites'),
  ('ginjinha','sulphites'),
  ('porto-tonico','sulphites'),
  ('sangria','sulphites'),
  ('alentejo-tinto','sulphites'),
  ('douro-tinto','sulphites')
) as v(sku, code)
join menu_item m on m.sku = v.sku;

-- ---------------------------------------------------------------------
-- Dietary tags
-- ---------------------------------------------------------------------
insert into menu_item_diet (item_id, diet_code)
select m.id, v.code
from (values
  ('pao-manteiga','vegetarian'),
  ('azeitonas','vegan'),('azeitonas','gluten_free'),
  ('queijo-serra','vegetarian'),('queijo-serra','gluten_free'),
  ('presunto','gluten_free'),
  ('ameijoas','gluten_free'),
  ('caldo-verde','gluten_free'),
  ('sopa-legumes','vegan'),('sopa-legumes','gluten_free'),
  ('creme-abobora','vegetarian'),('creme-abobora','gluten_free'),
  ('bacalhau-bras','house'),
  ('bacalhau-lagareiro','gluten_free'),
  ('polvo-lagareiro','gluten_free'),('polvo-lagareiro','house'),
  ('sardinhas','gluten_free'),
  ('robalo','gluten_free'),
  ('arroz-marisco','house'),
  ('francesinha','house'),('francesinha','spicy'),
  ('bitoque','house'),
  ('frango-churrasco','gluten_free'),('frango-churrasco','spicy'),
  ('picanha','gluten_free'),('picanha','house'),
  ('leitao','gluten_free'),('leitao','house'),
  ('cozido','house'),
  ('legumes-grelhados','vegan'),('legumes-grelhados','gluten_free'),
  ('risoto-cogumelos','vegetarian'),('risoto-cogumelos','gluten_free'),
  ('burger-grao','vegan'),
  ('acorda-veg','vegetarian'),
  ('pastel-nata','vegetarian'),('pastel-nata','house'),
  ('arroz-doce','vegetarian'),('arroz-doce','gluten_free'),
  ('leite-creme','vegetarian'),('leite-creme','gluten_free'),
  ('mousse-chocolate','vegetarian'),
  ('pudim-abade','vegetarian'),('pudim-abade','gluten_free'),('pudim-abade','house'),
  ('bolo-bolacha','vegetarian'),
  ('toucinho-ceu','vegetarian'),('toucinho-ceu','gluten_free'),
  ('cafe','vegan'),('cafe','gluten_free'),
  ('cha','vegan'),('cha','gluten_free'),
  ('agua-50','vegan'),('agua-50','gluten_free'),
  ('agua-gas','vegan'),('agua-gas','gluten_free'),
  ('sumo-laranja','vegan'),('sumo-laranja','gluten_free'),
  ('vinho-verde-copo','vegan'),('vinho-verde-copo','gluten_free'),
  ('ginjinha','gluten_free')
) as v(sku, code)
join menu_item m on m.sku = v.sku;

-- ---------------------------------------------------------------------
-- Floor plan: Sala, Esplanada, Balcão, Sala Privada
-- ---------------------------------------------------------------------
insert into zone (code, name_pt, name_en, sort_order) values
  ('sala',      'Sala Principal', 'Main Room',    1),
  ('esplanada', 'Esplanada',      'Terrace',      2),
  ('balcao',    'Balcão',         'Counter',      3),
  ('privado',   'Sala Privada',   'Private Room', 4);

insert into restaurant_table (zone_id, number, seats, grid_x, grid_y)
select z.id, v.num, v.seats, v.gx, v.gy
from (values
  ('sala',       1, 2, 0, 0), ('sala',       2, 2, 1, 0),
  ('sala',       3, 4, 2, 0), ('sala',       4, 4, 3, 0),
  ('sala',       5, 4, 0, 1), ('sala',       6, 4, 1, 1),
  ('sala',       7, 6, 2, 1), ('sala',       8, 6, 3, 1),
  ('sala',       9, 2, 0, 2), ('sala',      10, 4, 1, 2),
  ('sala',      11, 4, 2, 2), ('sala',      12, 4, 3, 2),
  ('esplanada', 13, 2, 0, 0), ('esplanada', 14, 2, 1, 0),
  ('esplanada', 15, 4, 2, 0), ('esplanada', 16, 4, 3, 0),
  ('esplanada', 17, 4, 0, 1), ('esplanada', 18, 4, 1, 1),
  ('esplanada', 19, 6, 2, 1), ('esplanada', 20, 6, 3, 1),
  ('balcao',    21, 1, 0, 0), ('balcao',    22, 1, 1, 0),
  ('balcao',    23, 1, 2, 0), ('balcao',    24, 1, 3, 0),
  ('privado',   25, 8, 0, 0), ('privado',   26,10, 1, 0)
) as v(zone, num, seats, gx, gy)
join zone z on z.code = v.zone;

-- ---------------------------------------------------------------------
-- Trading history for the sales calendar.
-- Closed Mondays. Deterministic pseudo-variation, no random(), so a
-- reseed always reproduces the same numbers.
-- ---------------------------------------------------------------------
insert into daily_closeout (business_date, gross_cents, vat_cents, net_cents, bills_count, covers_count, by_payment, closed_at, closed_by)
select
  d.day,
  d.gross,
  round(d.gross * 0.1165)::int,
  d.gross - round(d.gross * 0.1165)::int,
  greatest(1, round(d.gross / 4850.0)::int),
  greatest(1, round(d.gross / 2180.0)::int),
  jsonb_build_object(
    'cash',       round(d.gross * 0.27)::int,
    'mbway',      round(d.gross * 0.24)::int,
    'multibanco', round(d.gross * 0.31)::int,
    'card',       d.gross - round(d.gross * 0.27)::int - round(d.gross * 0.24)::int - round(d.gross * 0.31)::int
  ),
  d.day + time '23:48',
  (select id from staff where role = 'manager' limit 1)
from (
  select
    day,
    (case extract(isodow from day)
       when 2 then 96000 when 3 then 104000 when 4 then 118000
       when 5 then 181000 when 6 then 243000 when 7 then 207000
     end
     + (extract(doy from day)::int * 7919) % 26000
     - 13000)::int as gross
  from generate_series(current_date - interval '59 days', current_date - interval '1 day', interval '1 day') as g(day)
  where extract(isodow from g.day) <> 1        -- fechado às segundas
) d;

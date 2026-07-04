-- 3D-модель памятника (glTF/GLB) для объекта — опциональная ссылка на файл в /uploads
alter table objects add column if not exists model_url text;

-- (31/10 · 5.92) Depois de tocar em "Deixar banners leves" no admin (Banners prontos):
-- quem já usa um banner da galeria no cardápio passa para a versão WebP (o mesmo nome terminando em .webp).
-- Só troca quando o .webp existe no storage.
do $$
declare c text;
begin
  foreach c in array array['banner_url','banner1_url','banner2_url','banner3_url'] loop
    execute format($f$
      update public.profiles p set %1$I = regexp_replace(p.%1$I, '\.(png|jpe?g)$', '.webp', 'i')
      where p.%1$I ~* '/admin-banners/galeria/.+\.(png|jpe?g)$'
        and exists (select 1 from storage.objects o where o.bucket_id = 'admin-banners'
                    and o.name = regexp_replace(split_part(p.%1$I, '/admin-banners/', 2), '\.(png|jpe?g)$', '.webp', 'i'))
    $f$, c);
  end loop;
end $$;

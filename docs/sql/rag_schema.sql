-- Habilitar a extensão pgvector
create extension if not exists vector;

-- Tabela para armazenar as memórias/documentos
create table if not exists memories (
  id bigserial primary key,
  user_id text not null,          -- Identificador do utilizador (se aplicável)
  content text not null,          -- O texto do documento/memória
  metadata jsonb,                 -- Metadados auxiliares (ex: tags, source, type)
  embedding vector(1536),         -- O vetor de 1536 dimensões (text-embedding-3-small)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Criar um index HNSW para pesquisas mais rápidas (opcional, recomendado para grandes volumes)
-- create index on memories using hnsw (embedding vector_cosine_ops);

-- Função RPC para procurar similaridade usando a distância de cosseno (1 - cosine_distance)
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id text default null
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    memories.id,
    memories.content,
    memories.metadata,
    1 - (memories.embedding <=> query_embedding) as similarity
  from memories
  where (filter_user_id is null or memories.user_id = filter_user_id)
    and 1 - (memories.embedding <=> query_embedding) > match_threshold
  order by memories.embedding <=> query_embedding
  limit match_count;
end;
$$;

# chupinhador-e-organizador

CLI que puxa os posts salvos do Instagram, classifica por categoria/subcategoria a partir das hashtags da legenda, e
baixa o vídeo com `yt-dlp` de forma incremental (nunca baixa o mesmo post duas vezes).

Pipeline: `instaloader` lista os posts salvos (metadata só) → regras em `categories.json` classificam →
`yt-dlp --download-archive` baixa o que é novo → tudo (metadata, categoria, caminho do arquivo baixado) fica catalogado
em `{output-dir}/chupinhador.sqlite`.

## Pré-requisitos

```
brew install yt-dlp pipx
pipx install "instaloader[browser-cookie3]"
```

O extra `browser-cookie3` é obrigatório: é ele que permite o `--load-cookies
firefox` do instaloader. O bottle do
Homebrew não inclui esse extra, por isso instaloader vem via `pipx` em vez de `brew install instaloader`.

Firefox precisa estar logado no Instagram (ambas as ferramentas leem os cookies de sessão do Firefox).

## Rodando localmente

1. Instale os pré-requisitos acima e confirme que está logado no Instagram no Firefox.
2. Clone/entre na pasta do projeto (nenhum `npm install`/`deno install` é necessário — o Deno resolve as dependências na
   primeira execução).
3. Rode com um `--limit` baixo pra testar sem varrer todos os salvos:
   ```
   deno task dev --limit 3
   ```
4. Se der tudo certo, rode sem `--limit` (ou com um valor alto) pra processar o restante. Rodar de novo é seguro: o
   `yt-dlp` pula quem já está em `historico_downloads.txt`.

Ver todas as flags: `deno task dev --help`.

## Uso

```
deno task dev --limit 10
```

Flags:

- `--browser` (default `firefox`) — browser de onde ler os cookies de sessão.
- `--output-dir` (default `./instagram-saved`) — onde salvam os vídeos e o `historico_downloads.txt` (archive de dedupe
  do yt-dlp).
- `--limit` — número máximo de posts salvos a considerar nesta execução.
- `-h, --help` — mostra a ajuda e sai.

Edite `categories.json` para mapear hashtag → `{categoria, subcategoria}`. Post sem hashtag conhecida cai em
`sem-categoria/geral`. O arquivo é validado na hora (via schema) — erro de digitação nele quebra a CLI com uma mensagem
clara, em vez de virar categoria `undefined` silenciosa.

## Banco (catálogo dos posts)

Todo post scrapeado — baixado ou não — vira uma linha em `{output-dir}/chupinhador.sqlite`, tabela `posts` (`shortcode`,
`url`, `caption`, `categoria`, `subcategoria`, `taken_at`, `file_path`, `scraped_at`, `downloaded_at`). É pra isso que
serve: achar onde está o arquivo de um post, ou analisar o histórico salvo, sem precisar procurar pasta por pasta.
Sqlite é um arquivo comum — abre com o `sqlite3` (já vem no macOS), DB Browser for SQLite, ou qualquer client. Exemplos:

```
sqlite3 instagram-saved/chupinhador.sqlite "select categoria, subcategoria, count(*) from posts group by 1,2;"
sqlite3 instagram-saved/chupinhador.sqlite "select file_path from posts where shortcode = 'ABC123';"
```

`file_path` fica `NULL` até o vídeo ser baixado. Se um post já estava no `historico_downloads.txt` de uma execução
anterior a essa versão, o `yt-dlp` pula o download e a gente não tem como recuperar o path retroativamente — fica `NULL`
até uma nova execução redescobrir o arquivo.

### Migrando dados antigos

Se você rodou uma versão anterior desta CLI, pode ter um cache órfão em `{output-dir}/.raw/` (metadata scrapeada antes
do banco existir). Pra importar isso pro banco:

```
deno task migrate           # usa ./instagram-saved por padrão
deno task migrate ./outra-pasta
```

Depois de migrar e confirmar os dados (`sqlite3 ... "select count(*) from posts;"`), `.raw/` pode ser apagada — ela não
é mais usada por nada.

### Editou categories.json? Reclassifique

Editar `categories.json` só afeta posts novos. Pra reaplicar nos que já estão no banco (e mover o arquivo já baixado pra
pasta certa, se já tinha vídeo):

```
deno task reclassify           # usa ./instagram-saved por padrão
deno task reclassify ./outra-pasta
```

Compara a pasta onde o arquivo está de fato com a pasta que a classificação atual manda ele estar — roda quantas vezes
quiser, só move o que realmente mudou de categoria.

## Testes

```
deno task test
```

## Binário standalone

```
deno task compile
./chupinhador --limit 10
```

Gera `./chupinhador`, sem depender de Deno instalado pra rodar. `categories.json` é embutido no binário no momento da
compilação — editou o arquivo? recompile pra valer no binário (`deno task dev` sempre lê a versão atual do disco, sem
esse problema).


## Buy Me a Coffee

bitcoin:BC1P6SYW5V8GA6YEMF66C5Z6XQ0ZM5GKRPXE60GH9V6UW5SESFQLG92SNU6NEU?label=Github&message=Buy%20me%20a%20coffee
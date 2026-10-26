type Schema = Record<string, unknown>
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const integer = (minimum = 0, maximum = 2147483647) => ({
  type: 'integer',
  minimum,
  maximum,
})
const jsonResponse = (description: string, schema: Schema) => ({
  description,
  content: { 'application/json': { schema } },
})
const envelope = (name: string, schema: Schema) => ({
  type: 'object',
  required: [name],
  properties: { [name]: schema },
})
const array = (name: string) => ({ type: 'array', items: ref(name) })
const body = (name: string) => ({
  required: true,
  content: { 'application/json': { schema: ref(name) } },
})
const bearer = [{ bearerAuth: [] }]
const idParameter = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: integer(1),
})
const pageParameters = [
  { name: 'limit', in: 'query', schema: { ...integer(1, 100), default: 50 } },
  {
    name: 'offset',
    in: 'query',
    schema: { ...integer(0, 1000000), default: 0 },
  },
]
const errorDescriptions: Record<number, string> = {
  400: '入力・ID・ページ指定・JSON が不正、または注文合計が上限を超過',
  401: '認証なし・無効または期限切れのトークン・削除済みユーザー',
  404: '対象なし・削除済み商品・他人のデータへの操作',
  409: 'メール・SKU 重複、在庫不足、取消済み注文の変更、在庫更新の競合',
  413: 'リクエスト本文が 16 KiB を超過',
  500: '内部エラー',
}
const errors = (...statuses: number[]) =>
  Object.fromEntries(
    statuses.map((status) => [
      status,
      jsonResponse(errorDescriptions[status], ref('Error')),
    ]),
  )
const productFields = {
  sku: {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    example: 'SKU-001',
    description:
      '前後の空白を除去。空白のみ不可。削除後も SKU は再利用できません。',
  },
  name: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    example: 'サンプル商品',
    description: '前後の空白を除去。空白のみ不可。',
  },
  price: {
    ...integer(0, 100000000),
    example: 1200,
    description: '日本円の整数',
  },
  stock: {
    ...integer(0, 1000000),
    example: 10,
    description: '設定する販売可能残数。更新時は残数を置き換えます。',
  },
}
const timestamps = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
}
const commerceSchemas = {
  LoginInput: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        minLength: 1,
        maxLength: 254,
        example: 'alice@example.com',
        description:
          '前後の空白を除去して小文字化。長さは除去前に検証。メール形式必須。',
      },
      password: {
        type: 'string',
        format: 'password',
        writeOnly: true,
        minLength: 1,
        maxLength: 128,
        example: 'a-long-password',
      },
    },
  },
  LoginResult: {
    type: 'object',
    required: ['user', 'accessToken', 'tokenType', 'expiresIn'],
    properties: {
      user: ref('PublicUser'),
      accessToken: { type: 'string' },
      tokenType: { type: 'string', enum: ['Bearer'] },
      expiresIn: {
        type: 'integer',
        enum: [3600],
        description: '有効期間（秒）',
      },
    },
  },
  ProductInput: {
    type: 'object',
    required: ['sku', 'name', 'price', 'stock'],
    properties: productFields,
  },
  ProductPatch: {
    type: 'object',
    properties: productFields,
    anyOf: ['sku', 'name', 'price', 'stock'].map((field) => ({
      required: [field],
    })),
    description:
      '少なくとも1つの商品フィールドを指定。長さは空白除去前に検証。',
  },
  Product: {
    type: 'object',
    required: [
      'id',
      'ownerId',
      'sku',
      'name',
      'price',
      'stock',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      ...productFields,
      id: integer(1),
      ownerId: integer(1),
      ...timestamps,
      stock: {
        ...integer(),
        description:
          '販売可能残数。取消による返却時は設定上限の 1,000,000 を超える場合があります。',
      },
      deletedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  OrderInput: {
    type: 'object',
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        description: '商品 ID の重複不可。価格・商品名・SKU はサーバーで取得。',
        items: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { ...integer(1), example: 1 },
            quantity: { ...integer(1, 1000), example: 2 },
          },
        },
      },
    },
  },
  OrderItem: {
    type: 'object',
    required: ['productId', 'quantity', 'name', 'sku', 'unitPrice'],
    properties: {
      id: integer(1),
      orderId: integer(1),
      productId: integer(1),
      quantity: integer(1, 1000),
      name: productFields.name,
      sku: productFields.sku,
      unitPrice: productFields.price,
    },
    description: '注文時点の商品情報。商品の編集・削除では変わりません。',
  },
  Order: {
    type: 'object',
    required: [
      'id',
      'userId',
      'status',
      'total',
      'items',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      id: integer(1),
      userId: integer(1),
      status: { type: 'string', enum: ['PLACED', 'CANCELLED'] },
      total: { ...integer(), description: '合計金額（日本円）' },
      items: array('OrderItem'),
      ...timestamps,
    },
  },
}
const commercePaths = {
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'ログイン',
      requestBody: body('LoginInput'),
      description:
        '登録したアカウントでログインし、accessToken を Authorize に入力してください。未登録・パスワード不一致はともに401。',
      responses: {
        200: {
          ...jsonResponse('ログイン成功', ref('LoginResult')),
          headers: {
            'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } },
          },
        },
        ...errors(400, 413, 500),
        401: jsonResponse('メールまたはパスワードが不正', ref('Error')),
      },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'ログインユーザー',
      security: bearer,
      responses: {
        200: jsonResponse(
          '本人のユーザー情報',
          envelope('user', ref('PublicUser')),
        ),
        ...errors(401, 500),
      },
    },
  },
  '/products': {
    get: {
      tags: ['Products'],
      summary: '公開商品一覧',
      parameters: pageParameters,
      description: '削除済みを除外。商品 ID 昇順。',
      responses: {
        200: jsonResponse('商品一覧', envelope('products', array('Product'))),
        ...errors(400, 500),
      },
    },
    post: {
      tags: ['Products'],
      summary: '商品を作成',
      security: bearer,
      requestBody: body('ProductInput'),
      description: 'ログインユーザーが作成者になります。',
      responses: {
        201: jsonResponse('作成した商品', envelope('product', ref('Product'))),
        ...errors(400, 401, 409, 413, 500),
      },
    },
  },
  '/products/{id}': {
    parameters: [idParameter()],
    get: {
      tags: ['Products'],
      summary: '公開商品詳細',
      responses: {
        200: jsonResponse('商品詳細', envelope('product', ref('Product'))),
        ...errors(400, 404, 500),
      },
    },
    patch: {
      tags: ['Products'],
      summary: '自分の商品を更新',
      security: bearer,
      requestBody: body('ProductPatch'),
      responses: {
        200: jsonResponse('更新した商品', envelope('product', ref('Product'))),
        ...errors(400, 401, 404, 409, 413, 500),
      },
    },
    delete: {
      tags: ['Products'],
      summary: '自分の商品を論理削除',
      security: bearer,
      description:
        '削除後は公開一覧・詳細・お気に入りから非表示。新規注文不可。',
      responses: {
        204: { description: '削除しました（本文なし）' },
        ...errors(400, 401, 404, 500),
      },
    },
  },
  '/orders': {
    get: {
      tags: ['Orders'],
      summary: '自分の注文一覧',
      security: bearer,
      parameters: pageParameters,
      description: '取消済みを含み、注文 ID 降順。',
      responses: {
        200: jsonResponse('注文一覧', envelope('orders', array('Order'))),
        ...errors(400, 401, 500),
      },
    },
    post: {
      tags: ['Orders'],
      summary: '注文を作成',
      security: bearer,
      requestBody: body('OrderInput'),
      description:
        '注文作成と在庫減算を同時実行。合計の上限は 2,147,483,647 円。',
      responses: {
        201: jsonResponse('作成した注文', envelope('order', ref('Order'))),
        ...errors(400, 401, 404, 409, 413, 500),
      },
    },
  },
  '/orders/{id}': {
    parameters: [idParameter()],
    get: {
      tags: ['Orders'],
      summary: '自分の注文詳細',
      security: bearer,
      responses: {
        200: jsonResponse('注文詳細', envelope('order', ref('Order'))),
        ...errors(400, 401, 404, 500),
      },
    },
    put: {
      tags: ['Orders'],
      summary: '自分の注文の明細を全置換',
      security: bearer,
      requestBody: body('OrderInput'),
      description:
        '旧数量を返却してから新数量を確保し、現在の価格で再計算。取消済みは409。失敗時は旧注文と在庫を維持します。',
      responses: {
        200: jsonResponse('変更した注文', envelope('order', ref('Order'))),
        ...errors(400, 401, 404, 409, 413, 500),
      },
    },
    delete: {
      tags: ['Orders'],
      summary: '自分の注文を取消',
      security: bearer,
      description:
        '注文履歴は保持。在庫は一度だけ返却し、再実行も204。削除済み商品を含む注文も取消可能。',
      responses: {
        204: { description: '取消しました（本文なし）' },
        ...errors(400, 401, 404, 409, 500),
      },
    },
  },
  '/favorites': {
    get: {
      tags: ['Favorites'],
      summary: '自分のお気に入り一覧',
      security: bearer,
      parameters: pageParameters,
      description: '削除済み商品を除外。商品 ID 昇順。',
      responses: {
        200: jsonResponse(
          'お気に入りの商品',
          envelope('products', array('Product')),
        ),
        ...errors(400, 401, 500),
      },
    },
  },
  '/favorites/{productId}': {
    parameters: [idParameter('productId')],
    put: {
      tags: ['Favorites'],
      summary: 'お気に入りに登録',
      security: bearer,
      description: '同じ商品を再登録しても重複しません。',
      responses: {
        204: { description: '登録しました（本文なし）' },
        ...errors(400, 401, 404, 500),
      },
    },
    delete: {
      tags: ['Favorites'],
      summary: 'お気に入りを解除',
      security: bearer,
      description: '未登録でも204。',
      responses: {
        204: { description: '解除しました（本文なし）' },
        ...errors(400, 401, 500),
      },
    },
  },
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Hono EC API',
    version: '1.0.0',
    description:
      '認証・商品・在庫・注文・お気に入りを操作する EC API。JSON 本文の上限は 16 KiB。',
  },
  servers: [{ url: '/' }],
  tags: ['Health', 'Auth', 'Products', 'Orders', 'Favorites'].map((name) => ({
    name,
  })),
  paths: {
    ...commercePaths,
    '/': {
      get: {
        summary: 'API の疎通確認',
        tags: ['Health'],
        responses: {
          200: {
            description: 'API が稼働中',
            content: {
              'text/plain': {
                schema: { type: 'string', example: 'Hello Hono!' },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        summary: 'ヘルスチェック',
        tags: ['Health'],
        responses: {
          200: {
            description: 'API が稼働中',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string', enum: ['ok'] } },
                },
              },
            },
          },
        },
      },
    },
    '/health/db': {
      get: {
        summary: 'データベース接続確認',
        tags: ['Health'],
        responses: {
          200: {
            description: 'データベースに接続可能',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'database'],
                  properties: {
                    status: { type: 'string', enum: ['ok'] },
                    database: { type: 'string', enum: ['ok'] },
                  },
                },
              },
            },
          },
          503: {
            description: 'データベースに接続不可',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'database'],
                  properties: {
                    status: { type: 'string', enum: ['error'] },
                    database: { type: 'string', enum: ['unavailable'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'ユーザー登録',
        description:
          'メールは前後の空白を除去して小文字に、名前は前後の空白を除去して保存します。リクエスト本文の上限は 16 KiB です。',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegistrationInput' },
              example: {
                email: 'alice@example.com',
                password: 'a-long-password',
                name: 'Alice',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'ユーザーを登録しました',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['user'],
                  properties: {
                    user: { $ref: '#/components/schemas/PublicUser' },
                  },
                },
              },
            },
          },
          400: {
            description: '入力または JSON が不正',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Invalid email' },
              },
            },
          },
          409: {
            description: 'メールアドレスが登録済み',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Email is already registered' },
              },
            },
          },
          413: {
            description: 'リクエスト本文が 16 KiB を超過',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Payload Too Large' },
              },
            },
          },
          500: {
            description: '内部エラー',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: { error: 'Internal server error' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ...commerceSchemas,
      RegistrationInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            minLength: 1,
            maxLength: 254,
            description:
              '前後の空白を除去した後、有効なメール形式であること。長さは除去前に検証します。',
          },
          password: {
            type: 'string',
            format: 'password',
            writeOnly: true,
            minLength: 12,
            maxLength: 128,
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description:
              '省略可。空白のみは不可。長さは前後の空白の除去前に検証します。',
          },
        },
      },
      PublicUser: {
        type: 'object',
        required: ['id', 'email', 'name', 'createdAt'],
        properties: {
          id: { type: 'integer', example: 1 },
          email: {
            type: 'string',
            format: 'email',
            example: 'alice@example.com',
          },
          name: { type: 'string', nullable: true, example: 'Alice' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string' } },
      },
    },
  },
}

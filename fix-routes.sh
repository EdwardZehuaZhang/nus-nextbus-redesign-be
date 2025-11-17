#!/bin/bash
# Fix all route handlers to have explicit Promise<void> return type and remove early returns

sed -i '' 's/async (req: Request, res: Response) =>/async (req: Request, res: Response): Promise<void> =>/g' src/routes/bus.ts
sed -i '' 's/async (_req: Request, res: Response) =>/async (_req: Request, res: Response): Promise<void> =>/g' src/routes/bus.ts
sed -i '' 's/return res\.json/res.json/g' src/routes/bus.ts
sed -i '' '/res\.json(cached);$/a\
    return;' src/routes/bus.ts

sed -i '' 's/async (req: Request, res: Response) =>/async (req: Request, res: Response): Promise<void> =>/g' src/routes/lta.ts
sed -i '' 's/return res\.json/res.json/g' src/routes/lta.ts
sed -i '' '/res\.json(cached);$/a\
    return;' src/routes/lta.ts

sed -i '' 's/async (req: Request, res: Response) =>/async (req: Request, res: Response): Promise<void> =>/g' src/routes/google-routes.ts
sed -i '' 's/return res\.json/res.json/g' src/routes/google-routes.ts
sed -i '' '/res\.json(cached);$/a\
    return;' src/routes/google-routes.ts


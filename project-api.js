import express from 'express';

export function configureApp(app, db) {
  app.use(express.json({ limit: '10kb' }));

  app.use(express.static('public'));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/projects', async (req, res, next) => {
    try {
      res.json(await db.list());
    } catch (error) {
      next(error);
    }
  });

  function readId(req, res) {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({ error: 'Invalid project id.' });
      return null;
    }

    return id;
  }

  function readProject(req, res) {
    const name =
      typeof req.body?.name === 'string'
        ? req.body.name.trim()
        : '';

    const status = req.body?.status;

    if (
      name.length < 1 ||
      name.length > 80 ||
      !['Planned', 'In Progress', 'Completed'].includes(status)
    ) {
      res.status(400).json({
        error: 'Use a name of 1-80 characters and a valid status.'
      });

      return null;
    }

    const validPriorities = ['Low', 'Medium', 'High'];
    const priority = validPriorities.includes(req.body?.priority)
      ? req.body.priority
      : 'Medium';

    const description =
      typeof req.body?.description === 'string'
        ? req.body.description.trim().slice(0, 500)
        : '';

    return { name, status, priority, description };
  }

  app.post('/api/projects', async (req, res, next) => {
    try {
      const project = readProject(req, res);

      if (!project) return;

      const createdProject = await db.create(project);

      res.status(201).json(createdProject);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/projects/:id', async (req, res, next) => {
    try {
      const id = readId(req, res);

      if (id === null) return;

      const project = readProject(req, res);

      if (!project) return;

      const row = await db.update(id, project);

      if (!row) {
        return res.status(404).json({
          error: 'Project not found.'
        });
      }

      res.json(row);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/projects/:id', async (req, res, next) => {
    try {
      const id = readId(req, res);

      if (id === null) return;

      const deleted = await db.remove(id);

      if (!deleted) {
        return res.status(404).json({
          error: 'Project not found.'
        });
      }

      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'API route not found.'
    });
  });

  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: 'Invalid JSON.'
      });
    }

    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'Request too large.'
      });
    }

    console.error('Request failed:', error);

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error: 'Server error. Check the server terminal.'
    });
  });

  return app;
}
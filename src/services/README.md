# services

I/O and integration layer (data access, external APIs) behind interfaces. Services own side effects; UI and hooks call services, never fetch directly. Depend on abstractions (e.g. the Model Router, storage interface), never a concrete vendor.

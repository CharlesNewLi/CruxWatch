// mockNetworks.ts
export const mockNetworks = [
    {
      title: "Corporate Network",
      key: "network-1",
      children: [
        {
          title: "Site A",
          key: "site-1",
          children: [
            {
              title: "Router A",
              key: "device-1",
              type: "router",
              status: "online",
            },
            {
              title: "Switch A",
              key: "device-2",
              type: "switch",
              status: "offline",
            },
          ],
        },
        {
          title: "Site B",
          key: "site-2",
          children: [
            {
              title: "Router B",
              key: "device-3",
              type: "router",
              status: "online",
            },
          ],
        },
      ],
    },
  ];
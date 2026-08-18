(() => {
  const serverIp = 'play.cozycrafters.net';
  const statusEndpoint = `https://api.mcstatus.io/v2/status/java/${serverIp}?query=false&timeout=3`;
  const serverStatus = document.querySelector('[data-server-status]');
  const serverStatusText = document.querySelector('[data-server-status-text]');

  if (!serverStatus || !serverStatusText) return;

  const setServerStatus = (state, text) => {
    serverStatus.dataset.state = state;
    serverStatusText.textContent = text;
  };

  const refreshServerStatus = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(statusEndpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });

      if (!response.ok) throw new Error('Status request failed');

      const status = await response.json();
      const onlinePlayers = status?.players?.online;

      if (status.online === true && Number.isInteger(onlinePlayers) && onlinePlayers >= 0) {
        const playerLabel = onlinePlayers === 1 ? 'player' : 'players';
        setServerStatus('online', `${onlinePlayers} ${playerLabel} online`);
      } else if (status.online === false) {
        setServerStatus('offline', 'Server offline');
      } else {
        throw new Error('Unexpected status response');
      }
    } catch (error) {
      setServerStatus('unavailable', 'Status unavailable');
    } finally {
      window.clearTimeout(timeout);
    }
  };

  refreshServerStatus();
  window.setInterval(refreshServerStatus, 60000);
})();

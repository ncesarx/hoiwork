# HOIWORK Autonomous Governance timer

These system units belong only to HOIWORK. The timer calls the authenticated
scheduler endpoint through the existing script once per minute. The scheduler
enforces `enabled`, the per-organization `intervalMinutes` (currently 5), and
the advisory lock. A timer tick can therefore return `INTERVAL_NOT_DUE`.

Install as root on the HOIWORK production host after checking that the
organization's `commitEnabled` is `false`:

```bash
cd /home/ncesarx/hoiwork/apps/website
install -m 0644 deploy/systemd/hoiwork-autonomous-governance-automation.service /etc/systemd/system/
install -m 0644 deploy/systemd/hoiwork-autonomous-governance-automation.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hoiwork-autonomous-governance-automation.timer
systemctl status hoiwork-autonomous-governance-automation.timer --no-pager
systemctl list-timers --all --no-pager hoiwork-autonomous-governance-automation.timer
```

The service runs as `ncesarx` and loads the existing app environment via
`scripts/run-autonomous-governance-automation.sh`. It does not restart the app
or any other timer. Check the result after the first tick:

```bash
journalctl -u hoiwork-autonomous-governance-automation.service -n 30 --no-pager
```

The service exits nonzero on HTTP errors, and systemd records the failure.
For rollback, disable this timer only:

```bash
systemctl disable --now hoiwork-autonomous-governance-automation.timer
```

package __PACKAGE__.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BootCompletedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return

    val prefs = context.getSharedPreferences(ForegroundLocationService.PREFS_NAME, Context.MODE_PRIVATE)
    // Only recover an active session that still belongs to a signed-in user.
    // KEY_SIGNED_IN defaults true so existing logged-in installs are unaffected;
    // logout sets it false so tracking never restarts on reboot after sign-out.
    if (!prefs.getBoolean(ForegroundLocationService.KEY_ACTIVE, false)) return
    if (!prefs.getBoolean(ForegroundLocationService.KEY_SIGNED_IN, true)) return

    val serviceIntent = Intent(context, ForegroundLocationService::class.java).apply {
      this.action = ForegroundLocationService.ACTION_BOOT_RECOVERY
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }
  }
}

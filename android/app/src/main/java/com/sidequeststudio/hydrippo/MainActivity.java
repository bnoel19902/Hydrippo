package com.sidequeststudio.hydrippo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.sidequeststudio.hydrippo.health.HealthPlugin;
import com.sidequeststudio.hydrippo.widget.WidgetPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugins must be registered before the bridge starts.
        registerPlugin(WidgetPlugin.class);
        registerPlugin(HealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

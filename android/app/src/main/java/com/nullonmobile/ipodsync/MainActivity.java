package com.nullonmobile.ipodsync;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private static final String ACTION_USB_PERMISSION = "com.nullonmobile.ipodsync.USB_PERMISSION";
    private static final int APPLE_VENDOR_ID = 0x05ac;

    private UsbManager usbManager;
    private UsbDevice selectedDevice;
    private TextView statusText;
    private TextView deviceText;
    private TextView libraryText;
    private Button scanButton;
    private Button requestButton;
    private Button syncButton;

    private final List<String> library = new ArrayList<String>() {{
        add("Track 01 - Intro.mp3");
        add("Track 02 - Lost in Time.mp3");
        add("Track 03 - Skyline Drive.mp3");
    }};

    private final BroadcastReceiver usbReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (action == null) return;

            if (ACTION_USB_PERMISSION.equals(action)) {
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                if (device != null && granted) {
                    selectedDevice = device;
                    statusText.setText("Status: USB permission granted");
                    deviceText.setText("Device: " + device.getProductName());
                    Toast.makeText(context, "Permission granted", Toast.LENGTH_SHORT).show();
                } else {
                    statusText.setText("Status: permission denied");
                }
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
                UsbDevice detached = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (detached != null && selectedDevice != null && detached.getDeviceId() == selectedDevice.getDeviceId()) {
                    selectedDevice = null;
                    statusText.setText("Status: device disconnected");
                    deviceText.setText("Device: none");
                }
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        usbManager = (UsbManager) getSystemService(Context.USB_SERVICE);

        statusText = findViewById(R.id.statusText);
        deviceText = findViewById(R.id.deviceText);
        libraryText = findViewById(R.id.libraryText);
        scanButton = findViewById(R.id.scanButton);
        requestButton = findViewById(R.id.requestButton);
        syncButton = findViewById(R.id.syncButton);

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        registerReceiver(usbReceiver, filter);

        scanButton.setOnClickListener(v -> scanForUsbDevices());
        requestButton.setOnClickListener(v -> requestUsbPermission());
        syncButton.setOnClickListener(v -> syncLibraryToSelectedDevice());

        updateLibraryText();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(usbReceiver);
    }

    private void scanForUsbDevices() {
        HashMap<String, UsbDevice> devices = usbManager.getDeviceList();

        if (devices.isEmpty()) {
            statusText.setText("Status: no USB devices found");
            deviceText.setText("Device: none");
            return;
        }

        for (UsbDevice device : devices.values()) {
            Log.d(TAG, "Found USB device: " + device.getVendorId() + " / " + device.getProductId());

            if (device.getVendorId() == APPLE_VENDOR_ID) {
                selectedDevice = device;
                statusText.setText("Status: Apple USB device detected");
                deviceText.setText("Device: " + (device.getProductName() != null ? device.getProductName() : "iPod Nano"));
                return;
            }
        }

        statusText.setText("Status: USB device found, but not Apple vendor");
        deviceText.setText("Device: unsupported");
    }

    private void requestUsbPermission() {
        if (selectedDevice == null) {
            Toast.makeText(this, "Scan for a device first", Toast.LENGTH_SHORT).show();
            return;
        }

        PendingIntent permissionIntent = PendingIntent.getBroadcast(
                this,
                0,
                new Intent(ACTION_USB_PERMISSION),
                PendingIntent.FLAG_IMMUTABLE
        );

        if (usbManager.hasPermission(selectedDevice)) {
            statusText.setText("Status: USB permission already granted");
            Toast.makeText(this, "Permission already granted", Toast.LENGTH_SHORT).show();
            return;
        }

        usbManager.requestPermission(selectedDevice, permissionIntent);
        statusText.setText("Status: requesting USB permission");
    }

    private void syncLibraryToSelectedDevice() {
        if (selectedDevice == null) {
            Toast.makeText(this, "No compatible device selected", Toast.LENGTH_SHORT).show();
            return;
        }

        if (!usbManager.hasPermission(selectedDevice)) {
            Toast.makeText(this, "Grant device permission first", Toast.LENGTH_SHORT).show();
            return;
        }

        statusText.setText("Status: preparing sync...");

        // This is the place where device-specific USB class handling and file transfer logic go.
        // For an iPod Nano 3rd generation, the real implementation requires vendor/protocol-specific
        // knowledge, mass-storage mapping, and file layout handling.
        // This skeleton demonstrates the Android USB Host flow and keeps the sync point clearly isolated.

        UsbDeviceConnection connection = usbManager.openDevice(selectedDevice);
        if (connection == null) {
            statusText.setText("Status: could not open USB device");
            return;
        }

        UsbInterface usbInterface = selectedDevice.getInterface(0);
        boolean claimed = connection.claimInterface(usbInterface, true);

        if (!claimed) {
            statusText.setText("Status: could not claim interface");
            connection.close();
            return;
        }

        // Example bulk endpoint enumeration for a real transfer implementation.
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(i);
            int type = endpoint.getType();
            Log.d(TAG, "Endpoint type: " + type + " direction=" + endpoint.getDirection());
        }

        connection.releaseInterface(usbInterface);
        connection.close();

        statusText.setText("Status: sync queued for device");
        Toast.makeText(this, "Sync queued: " + library.size() + " tracks", Toast.LENGTH_SHORT).show();
    }

    private void updateLibraryText() {
        libraryText.setText("Library: " + library.size() + " songs");
    }
}

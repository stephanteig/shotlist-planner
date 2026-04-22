use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::Emitter;

/// Binds an ephemeral localhost port, appends the correct redirect_uri to the
/// provided Google auth URL, opens it in the system browser, then waits for
/// the OAuth redirect. Emits "oauth::code" with the auth code when done.
#[tauri::command]
fn start_oauth_listener(app_handle: tauri::AppHandle, url: String) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    // Append redirect_uri now that we know the port
    let full_url = format!("{}&redirect_uri=http://127.0.0.1:{}", url, port);
    open::that_detached(&full_url).map_err(|e| format!("Failed to open browser: {e}"))?;

    std::thread::spawn(move || {
        let Ok((mut stream, _)) = listener.accept() else {
            let _ = app_handle.emit("oauth::code", "");
            return;
        };

        let mut buf = vec![0u8; 8192];
        let n = stream.read(&mut buf).unwrap_or(0);
        let request = String::from_utf8_lossy(&buf[..n]);

        let code = request
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .and_then(|path| path.split('?').nth(1))
            .and_then(|qs| {
                qs.split('&')
                    .find(|p| p.starts_with("code="))
                    .and_then(|p| p.splitn(2, '=').nth(1).map(String::from))
            });

        let html = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{background:#0a0a0f;color:#e1e7ef;font-family:sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
</style></head><body>
<div style="text-align:center">
  <div style="font-size:2.5rem;margin-bottom:12px">✓</div>
  <h2 style="margin:0 0 8px;font-size:1.2rem">Innlogget</h2>
  <p style="margin:0;color:#6b7280;font-size:.9rem">Du kan lukke dette vinduet.</p>
</div>
<script>setTimeout(()=>window.close(),1200)</script>
</body></html>"#;

        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
             Content-Length: {}\r\nConnection: close\r\n\r\n{}",
            html.len(),
            html
        );
        let _ = stream.write_all(response.as_bytes());
        let _ = app_handle.emit("oauth::code", code.unwrap_or_default());
    });

    Ok(port)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![start_oauth_listener])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

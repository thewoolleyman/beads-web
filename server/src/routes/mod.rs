//! Route handlers for the beads-server API.
//!
//! This module contains all HTTP route handlers.
//! Additional handlers will be added as API endpoints are implemented.

pub mod agents;
pub mod beads;
pub mod cli;
pub mod dolt;
pub mod fs;
pub mod git;
pub mod lanes;
pub mod memory;
pub mod projects;
pub mod version;
pub mod watch;
pub mod worktree;

pub use projects::project_routes;
pub use watch::watch_beads;

use axum::{response::IntoResponse, Json};
use directories::UserDirs;
use tower_http::compression::CompressionLayer;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Health check response structure.
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
}

/// Health check endpoint handler.
///
/// Returns a JSON response indicating the server is running.
pub async fn health() -> impl IntoResponse {
    Json(HealthResponse { status: "ok" })
}

/// Cached path to the `bd` CLI binary.
///
/// Resolved once at first use and cached for the process lifetime.
/// Searches PATH first, then common install locations.
static BD_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();

/// Returns the path to the `bd` CLI binary, or `None` if not found.
///
/// Search order:
/// 1. `bd` in PATH (via `which`/`where`)
/// 2. `~/.cargo/bin/bd`
/// 3. `~/.local/bin/bd`
/// 4. `/usr/local/bin/bd`
/// 5. `~/.beads/bin/bd`
pub fn find_bd() -> Option<&'static PathBuf> {
    BD_PATH.get_or_init(|| {
        // Try PATH first
        if let Ok(output) = std::process::Command::new(if cfg!(windows) { "where" } else { "which" })
            .arg("bd")
            .output()
        {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout);
                let path = PathBuf::from(path_str.trim().lines().next().unwrap_or("").trim());
                if path.exists() {
                    tracing::info!("Found bd CLI in PATH: {}", path.display());
                    return Some(path);
                }
            }
        }

        // Search common locations
        let home = UserDirs::new().map(|d| d.home_dir().to_path_buf());
        let candidates: Vec<PathBuf> = if let Some(ref home) = home {
            let mut c = vec![
                home.join(".cargo").join("bin").join(if cfg!(windows) { "bd.exe" } else { "bd" }),
                home.join(".local").join("bin").join("bd"),
                home.join(".beads").join("bin").join("bd"),
            ];
            if !cfg!(windows) {
                c.push(PathBuf::from("/usr/local/bin/bd"));
            }
            c
        } else {
            vec![]
        };

        for candidate in &candidates {
            if candidate.exists() {
                tracing::info!("Found bd CLI at: {}", candidate.display());
                return Some(candidate.clone());
            }
        }

        tracing::warn!(
            "bd CLI not found. Searched PATH and: {}. \
             Install bd (https://github.com/gastownhall/beads) or add it to PATH.",
            candidates.iter().map(|p| p.display().to_string()).collect::<Vec<_>>().join(", ")
        );
        None
    }).as_ref()
}

/// Validates that a path is safe to access.
///
/// # Security
///
/// This function ensures that:
/// - The path can be canonicalized (no path traversal attacks)
/// - On Windows: the path is on a local drive (not a UNC network path)
/// - On Unix: the path is within the user's home directory
///
/// # Returns
///
/// - `Ok(())` if the path is valid and within allowed directories
/// - `Err(String)` with an error message if validation fails
pub fn validate_path_security(path: &Path) -> Result<(), String> {
    // Reject dolt:// virtual paths — these are not filesystem paths
    if path.to_string_lossy().starts_with("dolt://") {
        return Err("dolt:// paths cannot be used for filesystem operations".to_string());
    }

    // Canonicalize paths for comparison (resolves symlinks and ..)
    let canonical_path = match path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            // If path doesn't exist yet, check the parent
            if let Some(parent) = path.parent() {
                match parent.canonicalize() {
                    Ok(p) => p.join(path.file_name().unwrap_or_default()),
                    Err(_) => return Err("Invalid path".to_string()),
                }
            } else {
                return Err("Invalid path".to_string());
            }
        }
    };

    // On Windows, allow any local drive but block UNC network paths.
    // On Unix, restrict to the user's home directory.
    if cfg!(windows) {
        let path_str = canonical_path.to_string_lossy();
        // Windows canonicalize produces \\?\C:\... (extended-length path prefix).
        // Strip that prefix before checking for actual UNC paths.
        let normalized = path_str
            .strip_prefix("\\\\?\\")
            .unwrap_or(&path_str);
        // Real UNC paths: \\server\share or \\?\UNC\server\share
        if normalized.starts_with("\\\\") || normalized.starts_with("UNC\\") {
            return Err("Access denied: network (UNC) paths are not allowed".to_string());
        }
        // Must start with a drive letter like C:\
        if !normalized.starts_with(|c: char| c.is_ascii_alphabetic()) {
            return Err("Access denied: invalid path".to_string());
        }
    } else {
        let user_dirs = match UserDirs::new() {
            Some(u) => u,
            None => return Err("Could not determine user directories".to_string()),
        };

        let home_dir = user_dirs.home_dir();

        let canonical_home = match home_dir.canonicalize() {
            Ok(h) => h,
            Err(_) => return Err("Could not canonicalize home directory".to_string()),
        };

        if !canonical_path.starts_with(&canonical_home) {
            return Err("Access denied: path must be within home directory".to_string());
        }
    }

    Ok(())
}

/// Response compression for the whole router: gzip or brotli, whichever the
/// client accepts.
///
/// The default predicate leaves `text/event-stream` (the `/api/watch/beads`
/// SSE stream), gRPC, images and responses under 32 bytes uncompressed, so an
/// encoder never buffers a live event stream.
pub fn compression_layer() -> CompressionLayer {
    CompressionLayer::new().gzip(true).br(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_validate_home_path() {
        if let Some(user_dirs) = UserDirs::new() {
            let test_path = user_dirs.home_dir().join("test");
            // This might fail if test doesn't exist, but the parent check should work
            let result = validate_path_security(&test_path);
            // Should either succeed or fail with "Invalid path" (if test doesn't exist)
            assert!(result.is_ok() || result.unwrap_err().contains("Invalid"));
        }
    }

    #[test]
    fn test_reject_unsafe_paths() {
        if cfg!(windows) {
            // UNC paths should be rejected
            let result = validate_path_security(&PathBuf::from("\\\\server\\share\\file"));
            assert!(result.is_err());
            let err_msg = result.unwrap_err();
            assert!(err_msg.contains("denied") || err_msg.contains("Invalid") || err_msg.contains("network"));
        } else {
            // Unix: paths outside home should be rejected
            let result = validate_path_security(&PathBuf::from("/etc/passwd"));
            assert!(result.is_err());
            let err_msg = result.unwrap_err();
            assert!(err_msg.contains("denied") || err_msg.contains("Invalid"));
        }
    }

    // ── compression_layer ───────────────────────────────────────────────

    /// Serves `app` on an ephemeral loopback port and returns its base URL.
    async fn serve(app: axum::Router) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{}", addr)
    }

    fn compression_test_app() -> axum::Router {
        use axum::response::sse::{Event, KeepAlive, Sse};
        use axum::routing::get;
        use futures::stream;
        use std::convert::Infallible;

        axum::Router::new()
            .route(
                "/json",
                get(|| async { Json(serde_json::json!({ "beads": vec!["x".repeat(64); 64] })) }),
            )
            .route(
                "/sse",
                get(|| async {
                    let events = stream::iter(vec![Ok::<_, Infallible>(
                        Event::default().data("connected"),
                    )]);
                    Sse::new(events).keep_alive(KeepAlive::default())
                }),
            )
            .layer(compression_layer())
    }

    #[tokio::test]
    async fn test_compression_layer_gzips_json_when_accepted() {
        let base = serve(compression_test_app()).await;
        let client = reqwest::Client::new();

        let gz = client
            .get(format!("{}/json", base))
            .header("accept-encoding", "gzip")
            .send()
            .await
            .unwrap();
        assert_eq!(gz.headers().get("content-encoding").unwrap(), "gzip");
        let gz_len = gz.bytes().await.unwrap().len();

        let br = client
            .get(format!("{}/json", base))
            .header("accept-encoding", "br")
            .send()
            .await
            .unwrap();
        assert_eq!(br.headers().get("content-encoding").unwrap(), "br");

        let plain = client.get(format!("{}/json", base)).send().await.unwrap();
        assert!(plain.headers().get("content-encoding").is_none());
        let plain_len = plain.bytes().await.unwrap().len();
        assert!(gz_len < plain_len, "gzip {} should be smaller than {}", gz_len, plain_len);
    }

    #[tokio::test]
    async fn test_compression_layer_leaves_sse_stream_uncompressed() {
        let base = serve(compression_test_app()).await;
        let res = reqwest::Client::new()
            .get(format!("{}/sse", base))
            .header("accept-encoding", "gzip, br")
            .send()
            .await
            .unwrap();
        assert!(res
            .headers()
            .get("content-type")
            .unwrap()
            .to_str()
            .unwrap()
            .starts_with("text/event-stream"));
        assert!(res.headers().get("content-encoding").is_none());
        let mut res = res;
        let first = res.chunk().await.unwrap().unwrap();
        assert!(String::from_utf8_lossy(&first).contains("data: connected"));
    }
}

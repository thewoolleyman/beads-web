//! Board lane configuration.
//!
//! The kanban board renders one lane per status in the project's own
//! status set, ordered by a configured lane list. That list is read from
//! the `BEADS_WEB_LANES` environment variable at startup and served to the
//! frontend, so a tenant with a different lifecycle needs no code change.

use axum::{extract::Extension, response::IntoResponse, Json};
use serde::Serialize;
use std::env;
use std::sync::Arc;

/// Environment variable holding a comma-separated lane order.
pub const LANES_ENV: &str = "BEADS_WEB_LANES";

/// Default lane order: the livespec lifecycle.
pub const DEFAULT_LANES: [&str; 7] = [
    "backlog",
    "pending-approval",
    "ready",
    "active",
    "acceptance",
    "blocked",
    "closed",
];

/// Shared lane order, resolved once at startup.
pub type Lanes = Arc<Vec<String>>;

/// Response body for `GET /api/lanes`.
#[derive(Serialize)]
pub struct LanesResponse {
    pub lanes: Vec<String>,
}

/// Parse a comma-separated lane order.
///
/// Entries are trimmed and blank ones dropped. An absent, empty or
/// all-blank value yields [`DEFAULT_LANES`].
pub fn parse_lanes(raw: Option<&str>) -> Vec<String> {
    let parsed: Vec<String> = raw
        .unwrap_or("")
        .split(',')
        .map(|lane| lane.trim())
        .filter(|lane| !lane.is_empty())
        .map(|lane| lane.to_string())
        .collect();

    if parsed.is_empty() {
        return DEFAULT_LANES.iter().map(|lane| lane.to_string()).collect();
    }

    parsed
}

/// Resolve the configured lane order from the environment.
pub fn configured_lanes() -> Vec<String> {
    parse_lanes(env::var(LANES_ENV).ok().as_deref())
}

/// `GET /api/lanes` — the configured lane order.
pub async fn get_lanes(Extension(lanes): Extension<Lanes>) -> impl IntoResponse {
    Json(LanesResponse {
        lanes: lanes.as_ref().clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn defaults() -> Vec<String> {
        DEFAULT_LANES.iter().map(|lane| lane.to_string()).collect()
    }

    #[test]
    fn falls_back_to_the_livespec_order_when_unset() {
        assert_eq!(parse_lanes(None), defaults());
    }

    #[test]
    fn falls_back_when_the_value_is_empty_or_blank() {
        assert_eq!(parse_lanes(Some("")), defaults());
        assert_eq!(parse_lanes(Some("   ")), defaults());
        assert_eq!(parse_lanes(Some(" , ,")), defaults());
    }

    #[test]
    fn reads_a_custom_list_in_order() {
        assert_eq!(
            parse_lanes(Some("todo,doing,done")),
            vec!["todo".to_string(), "doing".to_string(), "done".to_string()]
        );
    }

    #[test]
    fn trims_whitespace_and_drops_empty_entries() {
        assert_eq!(
            parse_lanes(Some("  todo , ,\tdoing\n,done,")),
            vec!["todo".to_string(), "doing".to_string(), "done".to_string()]
        );
    }

    #[test]
    fn keeps_the_livespec_order_as_the_default() {
        assert_eq!(
            defaults(),
            vec![
                "backlog".to_string(),
                "pending-approval".to_string(),
                "ready".to_string(),
                "active".to_string(),
                "acceptance".to_string(),
                "blocked".to_string(),
                "closed".to_string(),
            ]
        );
    }
}

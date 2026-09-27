//! Who may run jobs. Every request must pass all of these before anything touches disk.

use angaara_bot::matrix_sdk::{
    deserialized_responses::{EncryptionInfo, VerificationLevel, VerificationState},
    ruma::{events::room::join_rules::JoinRule, OwnedUserId, UserId},
    Room, RoomMemberships,
};

#[derive(Debug, Clone)]
pub struct Policy {
    pub owner: OwnedUserId,
    /// Accept devices the owner never cross-signed. Off by default: a stolen password alone can't drive the runner.
    pub allow_unsigned_devices: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Rejection {
    /// Not from the owner. The runner stays silent so it doesn't reveal itself.
    NotOwner,
    NotEncrypted,
    UntrustedDevice(&'static str),
    RoomNotPrivate(&'static str),
}

impl Rejection {
    pub fn reason(&self) -> &'static str {
        match self {
            Rejection::NotOwner => "not the runner's owner",
            Rejection::NotEncrypted => "requests must be end-to-end encrypted",
            Rejection::UntrustedDevice(why) | Rejection::RoomNotPrivate(why) => why,
        }
    }
}

/// Checks the sender and the device the request was encrypted by.
pub fn check_sender(
    policy: &Policy,
    sender: &UserId,
    encryption: Option<&EncryptionInfo>,
) -> Result<(), Rejection> {
    if sender != policy.owner {
        return Err(Rejection::NotOwner);
    }
    let Some(info) = encryption else {
        return Err(Rejection::NotEncrypted);
    };
    if info.sender != policy.owner {
        return Err(Rejection::NotOwner);
    }
    check_verification(policy, &info.verification_state)
}

pub fn check_verification(policy: &Policy, state: &VerificationState) -> Result<(), Rejection> {
    match state {
        // Cross-signed by the owner's own key: fine even if we never verified the owner ourselves.
        VerificationState::Verified
        | VerificationState::Unverified(VerificationLevel::UnverifiedIdentity) => Ok(()),
        VerificationState::Unverified(VerificationLevel::UnsignedDevice)
            if policy.allow_unsigned_devices =>
        {
            Ok(())
        }
        VerificationState::Unverified(VerificationLevel::UnsignedDevice) => Err(
            Rejection::UntrustedDevice("device is not verified; verify this session in Angaara"),
        ),
        VerificationState::Unverified(VerificationLevel::VerificationViolation) => Err(
            Rejection::UntrustedDevice("owner's identity changed; re-pair the runner"),
        ),
        VerificationState::Unverified(_) => Err(Rejection::UntrustedDevice(
            "sender device could not be authenticated",
        )),
    }
}

/// The room must be encrypted, invite-only, and contain only the owner and the runner.
pub async fn check_room(policy: &Policy, room: &Room, runner: &UserId) -> Result<(), Rejection> {
    let encrypted = room
        .latest_encryption_state()
        .await
        .map(|s| s.is_encrypted())
        .unwrap_or(false);
    if !encrypted {
        return Err(Rejection::NotEncrypted);
    }
    if !matches!(
        room.join_rule(),
        Some(JoinRule::Invite) | Some(JoinRule::Private)
    ) {
        return Err(Rejection::RoomNotPrivate("room must be invite-only"));
    }
    let members = room
        .members(RoomMemberships::JOIN | RoomMemberships::INVITE | RoomMemberships::KNOCK)
        .await
        .map_err(|_| Rejection::RoomNotPrivate("could not load room members"))?;
    if members
        .iter()
        .any(|m| m.user_id() != policy.owner && m.user_id() != runner)
    {
        return Err(Rejection::RoomNotPrivate(
            "room has other members; only you and the runner may be in it",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use angaara_bot::matrix_sdk::deserialized_responses::DeviceLinkProblem;

    fn policy(allow_unsigned: bool) -> Policy {
        Policy {
            owner: "@owner:localhost".try_into().unwrap(),
            allow_unsigned_devices: allow_unsigned,
        }
    }

    #[test]
    fn strangers_and_unencrypted_requests_are_rejected() {
        let stranger: OwnedUserId = "@mallory:localhost".try_into().unwrap();
        assert_eq!(
            check_sender(&policy(false), &stranger, None),
            Err(Rejection::NotOwner)
        );
        let owner = policy(false).owner;
        assert_eq!(
            check_sender(&policy(false), &owner, None),
            Err(Rejection::NotEncrypted)
        );
    }

    #[test]
    fn device_trust_levels() {
        let p = policy(false);
        let ok = |s: VerificationState| check_verification(&p, &s).is_ok();
        assert!(ok(VerificationState::Verified));
        assert!(ok(VerificationState::Unverified(
            VerificationLevel::UnverifiedIdentity
        )));
        assert!(!ok(VerificationState::Unverified(
            VerificationLevel::UnsignedDevice
        )));
        assert!(!ok(VerificationState::Unverified(
            VerificationLevel::VerificationViolation
        )));
        assert!(!ok(VerificationState::Unverified(
            VerificationLevel::MismatchedSender
        )));
        assert!(!ok(VerificationState::Unverified(VerificationLevel::None(
            DeviceLinkProblem::MissingDevice
        ))));

        let lenient = policy(true);
        assert!(check_verification(
            &lenient,
            &VerificationState::Unverified(VerificationLevel::UnsignedDevice)
        )
        .is_ok());
        // Even lenient mode never accepts a changed identity.
        assert!(check_verification(
            &lenient,
            &VerificationState::Unverified(VerificationLevel::VerificationViolation)
        )
        .is_err());
    }
}

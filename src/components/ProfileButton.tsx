"use client";

import { useWallet } from "@txnlab/use-wallet-react";
import { Link, useParams, useLocation } from "react-router-dom"; // Import useParams and useLocation

export function ProfileButton() {
  const { activeAddress } = useWallet();
  const { address: profileAddressParam } = useParams<{ address: string }>(); // Get address from URL params
  const location = useLocation(); // Get current location

  // If no active wallet, don't show the button
  if (!activeAddress) {
    return null;
  }

  // Check if the current path is a profile page AND if it's the active user's profile
  const isOnOwnProfilePage = location.pathname.startsWith('/profile/') && profileAddressParam === activeAddress;

  // If the user is on their own profile page, hide the button
  if (isOnOwnProfilePage) {
    return null;
  }

  return (
    <Link to={`/profile/${activeAddress}`} className="btn-profile">
      <strong className="uppercase">Profile</strong>
      <div id="container-stars">
        <div id="stars"></div>
      </div>
      <div id="glow">
        <div className="circle"></div>
        <div className="circle"></div>
      </div>
    </Link>
  );
}
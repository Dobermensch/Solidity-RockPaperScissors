// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

contract GetHashedValue {
    // This is just a helper contract to generate a hashed value to send to the playGame method
    // It will not be there in production as its functionality would be carried out by a web app.
    function getHashedValue(uint256 move, bytes32 salt)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(move, salt));
    }
}
